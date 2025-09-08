// Performance monitoring utilities
export class PerformanceMonitor {
  private static marks: Map<string, number> = new Map();

  static startMark(name: string) {
    if (import.meta.env.DEV) {
      this.marks.set(name, performance.now());
      performance.mark(`${name}-start`);
    }
  }

  static endMark(name: string) {
    if (import.meta.env.DEV) {
      const startTime = this.marks.get(name);
      if (startTime) {
        const duration = performance.now() - startTime;
        performance.mark(`${name}-end`);
        performance.measure(name, `${name}-start`, `${name}-end`);
        console.log(`Performance [${name}]: ${duration.toFixed(2)}ms`);
        this.marks.delete(name);
      }
    }
  }

  static measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.startMark(name);
    return fn().finally(() => this.endMark(name));
  }

  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }
}

// Memory usage monitoring
export class MemoryMonitor {
  static logMemoryUsage(context?: string) {
    if (import.meta.env.DEV && 'memory' in performance) {
      const memory = (performance as any).memory;
      console.log(`Memory Usage [${context || 'Unknown'}]:`, {
        used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
      });
    }
  }

  static checkMemoryPressure(): boolean {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      return usageRatio > 0.8; // 80% threshold
    }
    return false;
  }
}