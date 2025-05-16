import React from 'react';

const MIN_PLAYERS_TO_START = 3;

function Lobby({ players, hostId, currentUserId, onStartGame, onLeaveGame }) {
  const isHost = currentUserId === hostId;
  const canStartGame = players.length >= MIN_PLAYERS_TO_START;

  return (
    <div className="lobby">
      <h2>Lobby</h2>
      <p>Waiting for players... ({players.length}/10)</p>
      <ul className="player-list">
        {players.map(player => (
          <li key={player.id}>
            {player.username}
            {player.id === hostId && <span className="host-badge">Host</span>}
            {player.id === currentUserId && <span> (You)</span>}
          </li>
        ))}
      </ul>
      {isHost && (
        <button
          onClick={onStartGame}
          disabled={!canStartGame}
          className="host-button"
        >
          Start Game ({players.length}/{MIN_PLAYERS_TO_START} min)
        </button>
      )}
      {!isHost && players.length < MIN_PLAYERS_TO_START && (
        <p className="game-status">Waiting for host to start the game (need at least {MIN_PLAYERS_TO_START} players).</p>
      )}
      {!isHost && players.length >= MIN_PLAYERS_TO_START && (
         <p className="game-status">Waiting for host ({players.find(p => p.id === hostId)?.username || '...'}) to start the game.</p>
      )}
       <button onClick={onLeaveGame} className="leave-button">Leave Game</button>
    </div>
  );
}

export default Lobby;