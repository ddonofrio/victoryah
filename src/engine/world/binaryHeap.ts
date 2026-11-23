/** Minimal binary min-heap keyed by a numeric priority. Ties are broken by insertion order. */
export class BinaryHeap<T> {
  private readonly items: { value: T; priority: number; order: number }[] = [];
  private counter = 0;

  get size(): number {
    return this.items.length;
  }

  push(value: T, priority: number): void {
    this.items.push({ value, priority, order: this.counter++ });
    this.bubbleUp(this.items.length - 1);
  }

  pop(): T | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0 && last) {
      this.items[0] = last;
      this.sinkDown(0);
    }
    return top?.value;
  }

  private less(a: number, b: number): boolean {
    const x = this.items[a]!;
    const y = this.items[b]!;
    return x.priority < y.priority || (x.priority === y.priority && x.order < y.order);
  }

  private swap(a: number, b: number): void {
    const tmp = this.items[a]!;
    this.items[a] = this.items[b]!;
    this.items[b] = tmp;
  }

  private bubbleUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) return;
      this.swap(i, parent);
      i = parent;
    }
  }

  private sinkDown(index: number): void {
    let i = index;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < this.items.length && this.less(left, smallest)) smallest = left;
      if (right < this.items.length && this.less(right, smallest)) smallest = right;
      if (smallest === i) return;
      this.swap(i, smallest);
      i = smallest;
    }
  }
}
