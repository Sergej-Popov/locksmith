import * as log from "log";
import { concurrently, run } from "./util.ts";
import { PwnedService } from "./pwnd-service.ts";
import { ProgressBar } from "./progress-bar.ts";

export interface ICredential {
  id: string;
  title: string;
  username: string;
  password: string;
  isPwned: boolean;
  reuseCount: number;
  usingHttps: boolean | "partially";
}

export interface ICredentialRepository {
  getCredentials(query?: string, url?: string): Promise<ICredential[]>;
}

export class BitwardenRepository implements ICredentialRepository {
  constructor(private session: string, private pwnedService: PwnedService) {}

  private async getAllCredentials() {
    const args = ["list", "items", "--session", this.session];
    const items = await run<BitwardenItem[]>("bw", args);

    const filtered = items.filter((item) => !!item.login?.password);
    return filtered;
  }

  private async getCredentialsWithQuery(query: string) {
    const args = [
      "list",
      "items",
      "--session",
      this.session,
      "--search",
      query,
    ];

    log.debug("Args", args);

    const items = await run<BitwardenItem[]>("bw", args);
    const filtered = items.filter((item) => !!item.login.password);
    return filtered;
  }

  async getCredentials(
    query?: string,
    url?: string,
  ): Promise<ICredential[]> {
    const allItems = await this.getAllCredentials();

    let items = query ? await this.getCredentialsWithQuery(query) : allItems;

    items = url
      ? items.filter((item) =>
        item.login.uris.some((u) => {
          try {
            return new URL(u.uri).hostname === url;
          } catch {
            return false;
          }
        })
      )
      : items;

    if (items.length === 0) {
      log.debug("No items found");
      return [];
    }

    const creds: ICredential[] = [];
    const bar = new ProgressBar(items.length);

    const reuseCounts = this.reuseCount(allItems);

    await concurrently(items, async (item) => {
      const check = await this.pwnedService.checkPassword(item.login.password);

      const reuseCount = reuseCounts.find((r) =>
        r.password === item.login.password
      )?.reuseCount || 0;

      const allHttps = item.login.uris.every((u) => u.uri.startsWith("https"));
      const partiallyHttps = item.login.uris.some((u) =>
        u.uri.startsWith("https")
      );
      const usingHttps = allHttps ? true : partiallyHttps ? "partially" : false;

      creds.push({
        id: item.id,
        title: item.name,
        username: item.login.username,
        password: item.login.password,
        isPwned: check.isPwned,
        reuseCount,
        usingHttps,
      });

      bar.tick();
    });

    bar.clear();
    log.debug("Items found", creds.length);

    return creds;
  }

  private reuseCount(
    items: BitwardenItem[],
  ): { password: string; reuseCount: number }[] {
    const grouped = Object.entries(
      Object.groupBy(items, (item) => item.login.password),
    );

    const filtered = grouped.filter(([_, creds]) =>
      creds && creds.length > 1
    ) as [string, BitwardenItem[]][];

    const sorted = filtered.sort((a, b) => b[1].length - a[1].length);

    return sorted.map(([password, credentials]) => {
      const reuseCount = credentials.length;
      return { password, reuseCount };
    });
  }
}

interface BitwardenItem {
  passwordHistory: {
    "lastUsedDate": string;
    "password": string;
  }[] | null;
  revisionDate: string;
  creationDate: string;
  deletedDate: string | null;
  object: "item";
  id: string;
  organizationId: string | null;
  folderId: string | null;
  type: number;
  reprompt: number;
  name: string;
  notes: string | null;
  favorite: boolean;
  login: {
    // deno-lint-ignore no-explicit-any
    fido2Credentials: any[];
    uris: {
      match: string | null;
      uri: string;
    }[];
    username: string;
    password: string;
    totp: string | null;
    passwordRevisionDate: string | null;
  };
  collectionIds: string[];
}
