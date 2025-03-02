export class ProgressBar {
  private current = 0;

  constructor(private total: number, private barLength = 10) {}

  tick() {
    this.current++;
    const progress = Math.round(((this.current + 1) / this.total) * 100);
    const completed = Math.floor(
      ((this.current + 1) / this.total) * this.barLength,
    );
    const remaining = this.barLength - completed;

    const progressBar = `\r[${"■".repeat(completed)}${
      " ".repeat(remaining)
    }] ${progress}% complete`;
    Deno.stdout.writeSync(new TextEncoder().encode(progressBar));
  }

  public clear() {
    Deno.stdout.writeSync(new TextEncoder().encode("\n"));
  }
}
