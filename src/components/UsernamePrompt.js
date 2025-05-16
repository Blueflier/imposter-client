import React, { useState } from 'react';

function UsernamePrompt({ onUsernameSubmit }) {
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onUsernameSubmit(username.trim());
    }
  };

  return (
    <div className="username-prompt">
      <h2>Enter Your Name</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Your name"
          maxLength="20"
          required
        />
        <button type="submit">Join Game</button>
      </form>
    </div>
  );
}

export default UsernamePrompt;