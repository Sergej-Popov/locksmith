import * as log from "log";

export class PwnedService {
  public async checkPassword(
    password: string,
  ): Promise<{ isPwned: boolean; riskScore?: number }> {
    const sha1 = await crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode(password),
    );
    const sha1Hex = Array.from(new Uint8Array(sha1))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const sha1Prefix = sha1Hex.slice(0, 5);
    const sha1Suffix = sha1Hex.slice(5);

    log.debug(`${sha1Prefix} ${sha1Suffix}`);

    const pwnedResponse = await fetch(
      `https://api.pwnedpasswords.com/range/${sha1Prefix}`,
    );
    const pwnedText = await pwnedResponse.text();
    const pwnedLines = pwnedText.split("\n");
    const pwnedSuffixes = pwnedLines.map((line) => {
      const parts = line.split(":");
      return { restOfSha: parts[0], count: parseInt(parts[1]) };
    });

    log.debug(`Found ${pwnedSuffixes.length} suffixes`);

    const found = pwnedSuffixes.find((s) =>
      s.restOfSha.toLowerCase() === sha1Suffix.toLowerCase()
    );
    const isPwned = !!found;
    if (isPwned) {
      log.debug(`Password is compromised, (risk score: ${found.count})`);
    } else {
      log.debug("Password is safe");
    }

    return { isPwned: isPwned, riskScore: found?.count || 0 };
  }
}
