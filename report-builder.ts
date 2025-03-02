import { Logger } from "log";
import { ICredential, ICredentialRepository } from "./credential-repository.ts";
import { PwnedService } from "./pwnd-service.ts";

export class ReportBuilder {
  constructor(
    private log: Logger,
    private passRepo: ICredentialRepository,
    private pwndService: PwnedService,
  ) {}

  public async pwnedPasswords(): Promise<ICredential[]> {
    const allItems = await this.passRepo.getCredentials();

    const compromisedItems: ICredential[] = [];

    for (const item of allItems) {
      const check = await this.pwndService.checkPassword(item.password);

      if (check.isPwned) {
        compromisedItems.push(item);
        this.log.debug(
          `Compromised: Id: ${item.id} | Name: ${item.title} | Username: ${item.username}`,
        );
      }
    }

    return compromisedItems;
  }
}
