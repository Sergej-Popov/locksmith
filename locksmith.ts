import { Command, EnumType } from "@cliffy/command";
import * as log from "log";
import { PwnedService } from "./pwnd-service.ts";
import {
  BitwardenRepository,
  ICredentialRepository,
} from "./credential-repository.ts";
import {
  IReportSync,
  ReportSyncFactory,
  ReportSyncType,
} from "./report-sync.ts";

const pwndService = new PwnedService();
let reportSync: IReportSync;
let credentialsRepo: ICredentialRepository;

async function setupLogger(verbose: boolean) {
  const level = verbose
    ? log.getLevelName(log.LogLevels.DEBUG)
    : log.getLevelName(log.LogLevels.INFO);

  if (verbose) log.info(`Verbose mode enabled (log level: ${level})`);

  await log.setup({
    handlers: {
      console: new log.ConsoleHandler(level),
    },
    loggers: {
      default: {
        level,
        handlers: ["console"],
      },
    },
  });
}

function setupServices(
  session: string,
  output: string | undefined,
  reporter: ReportSyncType,
) {
  if (session === undefined) {
    throw new Error("Session is required");
  }

  if (!output && reporter === "json") {
    log.warn(
      "No output file specified, using default locksmith-reports-{date}.json",
    );
    const today = Temporal.Now.plainDateISO();
    output = `locksmith-report-${today.year}-${today.month}-${today.day}.json`;
  }

  if (!output && reporter === "csv") {
    log.warn(
      "No output file specified, using default locksmith-reports-{date}.csv",
    );
    const today = Temporal.Now.plainDateISO();
    output = `locksmith-report-${today.year}-${today.month}-${today.day}.csv`;
  }

  reportSync = ReportSyncFactory.create(
    reporter as ReportSyncType,
    output?.toString() ?? "",
  );

  credentialsRepo = new BitwardenRepository(session, pwndService);
}

async function checkReusedPasswords() {
  const items = await credentialsRepo.getCredentials();

  const reused = items.filter((item) => item.reuseCount > 1);
  const sorted = reused.sort((a, b) => b.reuseCount - a.reuseCount);

  reportSync.writeReport(sorted);
}

async function checkAllPasswords() {
  const items = await credentialsRepo.getCredentials();
  const compromisedItems = items.filter((item) => item.isPwned);

  await reportSync.writeReport(compromisedItems);
}

async function checkUrlsForHttps() {
  const items = await credentialsRepo.getCredentials();
  const notUsingHttps = items.filter((item) => item.usingHttps !== true);

  await reportSync.writeReport(notUsingHttps);
}

async function checkOnePasswords(password: string) {
  const items = await credentialsRepo.getCredentials();

  const matched = items.filter((item) => item.password === password);

  if (matched.length === 0) {
    log.info("No records found");
    return;
  }

  await reportSync.writeReport(matched);
}
const reporterTypes = new EnumType(["console", "json", "csv"]);

const app = new Command().name("locksmith").description(
  "CLI utility to check Bitwarden passwords for security gaps.",
);

app
  .command(
    "pwned-passwords",
    "Check all passwords against pwned service",
  )
  .option("-v, --verbose", "Verbose output")
  .type("report", reporterTypes)
  .option("-r, --reporter <report:string>", "Report type (console, json)", {
    default: "console",
  })
  .option("-o, --output [file:string]", "Output file", { required: false })
  .option("-s, --session <session:string>", "Bitwarden session", {
    required: true,
  })
  .action(async ({ session, verbose, reporter, output }) => {
    setupLogger(!!verbose);
    setupServices(session, output?.toString(), reporter as ReportSyncType);

    await checkAllPasswords();
  });

app
  .command("one-pwned-password", "Check single password against pwned service")
  .option("-p, --password <password:string>", "Password to check", {
    required: true,
  })
  .option("-v, --verbose", "Verbose output")
  .type("report", reporterTypes)
  .option("-r, --reporter <report:string>", "Report type (console, json)", {
    default: "console",
  })
  .option("-o, --output [file:string]", "Output file", { required: false })
  .option("-s, --session <session:string>", "Bitwarden session", {
    required: true,
  })
  .action(async ({ session, verbose, output, reporter, password }) => {
    setupLogger(!!verbose);
    setupServices(session, output?.toString(), reporter as ReportSyncType);

    await checkOnePasswords(password);
  });

app
  .command("reused-passwords", "Check for reused passwords")
  .option("-v, --verbose", "Verbose output")
  .type("report", reporterTypes)
  .option("-r, --reporter <report:string>", "Report type (console, json)", {
    default: "console",
  })
  .option("-o, --output [file:string]", "Output file", { required: false })
  .option("-s, --session <session:string>", "Bitwarden session", {
    required: true,
  })
  .action(async ({ session, verbose, output, reporter }) => {
    setupLogger(!!verbose);
    setupServices(session, output?.toString(), reporter as ReportSyncType);
    await checkReusedPasswords();
  });

app
  .command("unsecure-urls", "Check URLs using HTTPS")
  .option("-v, --verbose", "Verbose output")
  .type("report", reporterTypes)
  .option("-r, --reporter <report:string>", "Report type (console, json)", {
    default: "console",
  })
  .option("-o, --output [file:string]", "Output file", { required: false })
  .option("-s, --session <session:string>", "Bitwarden session", {
    required: true,
  })
  .action(async ({ session, verbose, output, reporter }) => {
    setupLogger(!!verbose);
    setupServices(session, output?.toString(), reporter as ReportSyncType);
    await checkUrlsForHttps();
  });

await app.parse(Deno.args);
