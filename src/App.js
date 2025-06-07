import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [todos, setTodos] = useState(() => {
    const saved = localStorage.getItem('todos');
    return saved ? JSON.parse(saved) : [];
  });
  const [text, setText] = useState('');

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTodos([...todos, { id: Date.now(), text: trimmed, done: false }]);
    setText('');
  };

  const toggleTodo = id => {
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const deleteTodo = id => {
    setTodos(todos.filter(t => t.id !== id));
  };

  return (
    <div className="App">
      <h1>Todo List</h1>
      <div className="input-row">
        <input
          type="text"
          value={text}
          placeholder="Add a todo"
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTodo()}
        />
        <button onClick={addTodo}>Add</button>
      </div>
      <ul className="todo-list">
        {todos.length === 0 && <li className="empty">No todos</li>}
        {todos.map(todo => (
          <li key={todo.id} className={todo.done ? 'done' : ''}>
            <label>
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => toggleTodo(todo.id)}
              />
              <span>{todo.text}</span>
            </label>
            <button className="delete" onClick={() => deleteTodo(todo.id)}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
