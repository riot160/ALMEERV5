export class MessageQueue {
  constructor() {
    this.queue      = [];
    this.processing = false;
  }

  add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      if (!this.processing) this._process();
    });
  }

  async _process() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }
    this.processing = true;
    const { fn, resolve, reject } = this.queue.shift();
    try {
      const result = await fn();
      resolve(result);
    } catch (err) {
      reject(err);
    }
    const delay = 1000 + Math.random() * 500;
    setTimeout(() => this._process(), delay);
  }
      }
