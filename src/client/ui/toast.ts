/** Brief, non-blocking notifications ("Insufficient resources", "Ore deposit discovered"...). */
export class Toast {
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly element: HTMLElement) {}

  show(message: string, seconds = 2.5): void {
    this.element.textContent = message;
    this.element.classList.add('visible');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.element.classList.remove('visible'), seconds * 1000);
  }
}
