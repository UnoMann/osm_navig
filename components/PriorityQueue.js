class PriorityQueue {
  constructor() {
    this.queue = [];
  }

  enqueue(element, priority) {
    // Добавляем элемент в очередь с указанным приоритетом
    this.queue.push({ element, priority });
    // Сортируем очередь по возрастанию приоритета
    this.queue.sort((a, b) => a.priority - b.priority);
  }

  dequeue() {
    // Удаляем и возвращаем элемент с наивысшим приоритетом
    return this.queue.shift();
  }

  isEmpty() {
    // Проверяем, пуста ли очередь
    return this.queue.length === 0;
  }

  contains(element) {
    // Проверяем, содержится ли элемент в очереди
    return this.queue.some(item => item.element === element);
  }
}