import { ICredential } from "./credential-repository.ts";

export interface IReportSync {
  writeReport(credentials: ICredential[]): Promise<void>;
}

export class ConsoleReportSync implements IReportSync {
  // deno-lint-ignore require-await
  async writeReport(credentials: ICredential[]): Promise<void> {
    console
      .table(
        credentials.map((c) => ({
          Id: c.id,
          Title: c.title,
          Username: c.username,
          Password: c.password,
          Reused: c.reuseCount,
          Pwned: c.isPwned,
          UsingHTTPS: c.usingHttps,
        })),
      );
  }
}

export class JsonReportSync implements IReportSync {
  constructor(private output: string) {}

  async writeReport(credentials: ICredential[]): Promise<void> {
    await write(this.output, JSON.stringify(credentials, null, 2));
  }
}

async function write(output: string, data: string) {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);
  await Deno.writeFile(output, encoded);
}

export class CsvReportSync implements IReportSync {
  constructor(private output: string) {}

  async writeReport(credentials: ICredential[]): Promise<void> {
    const header = "Id,Title,Username,Password,ReuseCount,IsPwned,UsingHTTPS";
    const rows = credentials.map((c) =>
      `${c.id},${c.title},${c.username},${c.password},${c.reuseCount},${c.isPwned},${c.usingHttps}`
    );
    const csvContent = [header, ...rows].join("\n");

    await write(this.output, csvContent);
  }
}

export type ReportSyncType = "console" | "json" | "csv";

export class ReportSyncFactory {
  public static create(
    type: "console" | "json" | "csv",
    output: string,
  ): IReportSync {
    if (type === "json") return new JsonReportSync(output);
    if (type === "csv") return new CsvReportSync(output);

    return new ConsoleReportSync();
  }
}
