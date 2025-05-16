import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { socket, connectSocket, disconnectSocket } from './socket';
import UsernamePrompt from './components/UsernamePrompt';
import Lobby from './components/Lobby';
import Game from './components/Game';
import './App.css';

const MIN_PLAYERS_TO_START = 3; // Consistent with server

function App() {
  const [user, setUser] = useState(null); // { id, username }
  const [needsUsername, setNeedsUsername] = useState(true);
  
  const [players, setPlayers] = useState([]);
  const [hostId, setHostId] = useState(null); // Store userId of the host
  const [currentError, setCurrentError] = useState('');
  const [currentInfo, setCurrentInfo] = useState('');

  // Game specific state
  const [gameState, setGameState] = useState({ phase: 'lobby', roundNumber: 0 }); // server's gameState.phase + roundNumber
  const [question, setQuestion] = useState('');
  const [isImposter, setIsImposter] = useState(false);
  const [answers, setAnswers] = useState([]); // [{ username, answer }]
  const [currentQuestionNormal, setCurrentQuestionNormal] = useState(''); // For TTS reveal

  const clearMessages = () => {
    setCurrentError('');
    setCurrentInfo('');
  };

  const handleUsernameSubmit = useCallback((username) => {
    clearMessages();
    let localUserId = localStorage.getItem('userId');
    if (!localUserId) {
        localUserId = uuidv4();
        localStorage.setItem('userId', localUserId);
    }
    localStorage.setItem('username', username);
    
    const newUser = { id: localUserId, username };
    setUser(newUser);
    setNeedsUsername(false);
    connectSocket(); // Connect after getting username
    socket.emit('join-game', { username: newUser.username, userId: newUser.id });
  }, []);

  const handleLeaveGame = useCallback(() => {
    if (window.confirm("Are you sure you want to leave the game? This will clear your session.")) {
        socket.emit('leave-game');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        setUser(null);
        setNeedsUsername(true);
        setPlayers([]);
        setHostId(null);
        setGameState({ phase: 'lobby', roundNumber: 0 });
        setQuestion('');
        setIsImposter(false);
        setAnswers([]);
        setCurrentQuestionNormal('');
        clearMessages();
        disconnectSocket(); // Important to disconnect fully
        // Optionally: window.location.reload(); to ensure clean state.
    }
  }, []);


  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    const storedUsername = localStorage.getItem('username');

    if (storedUserId && storedUsername) {
        setUser({ id: storedUserId, username: storedUsername });
        setNeedsUsername(false);
        connectSocket(); // Attempt to connect with existing credentials
        socket.emit('request-session-restore', { userId: storedUserId });
    } else {
        setNeedsUsername(true);
    }

    // Socket event listeners
    socket.on('connect', () => {
        console.log('Connected to server with socket ID:', socket.id);
        // If user details are already set (e.g., from LS prior to connect), re-emit join or restore
        const currentLocalUserId = localStorage.getItem('userId');
        const currentLocalUsername = localStorage.getItem('username');
        if (currentLocalUserId && currentLocalUsername && !needsUsername) {
             // If reconnected after a drop, and not part of initial session restore flow
            if (!socket.auth) { // socket.auth would be set by request-session-restore path
                 console.log("Re-emitting join-game on connect for:", currentLocalUsername);
                 socket.emit('join-game', { username: currentLocalUsername, userId: currentLocalUserId });
            }
        }
    });
    
    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        // setCurrentError('Disconnected from server. Attempting to reconnect...');
        // Don't immediately clear user data, allow reconnection attempts by socket.io
        // If reconnection fails permanently, user might need to "rejoin"
    });

    socket.on('session-restored', (data) => {
        console.log('Session restored:', data);
        setUser(data.user);
        setPlayers(data.players);
        setHostId(data.hostId);
        setGameState(data.gameState); // Restore full game state
         // If game is in progress, restore relevant details
        if (data.gameState.phase !== 'lobby' && data.gameState.currentQuestionPair) {
            const questionText = data.user.id === data.gameState.imposterId ? data.gameState.currentQuestionPair.imposter : data.gameState.currentQuestionPair.normal;
            setQuestion(questionText);
            setIsImposter(data.user.id === data.gameState.imposterId);
            if (data.gameState.answers) {
                setAnswers(Object.values(data.gameState.answers).map(a => ({ username: a.username, answer: a.answer })));
            }
            if (data.gameState.currentQuestionPair.normal){
                setCurrentQuestionNormal(data.gameState.currentQuestionPair.normal);
            }
        }
        setNeedsUsername(false);
        clearMessages();
    });
    
    socket.on('session-restore-failed', () => {
        console.log('Session restore failed. Clearing local session and prompting for username.');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        setUser(null);
        setNeedsUsername(true); // Prompt for new username
    });


    socket.on('join-success', ({ userId, username }) => {
        // This might be redundant if setUser already called, but good for confirmation
        // Or if server assigns a different userId (though current setup client generates)
        console.log(`Successfully joined as ${username} with ID ${userId}`);
        if (user && user.id === userId) { // If already set by submit, this is fine
            return;
        }
        setUser({id: userId, username});
    });

    socket.on('lobby-update', (data) => {
        console.log('Lobby update:', data);
        setPlayers(data.players);
        setHostId(data.hostId);
        // Update local game phase if server indicates a change (e.g. game ended, back to lobby)
        if (data.gameState && data.gameState.phase !== gameState.phase) {
            setGameState(prev => ({ ...prev, phase: data.gameState.phase }));
        }
         // If we are moved to lobby, reset game specific things
        if (data.gameState && data.gameState.phase === 'lobby' && gameState.phase !== 'lobby') {
            setQuestion('');
            setIsImposter(false);
            setAnswers([]);
            setCurrentQuestionNormal('');
        }
    });
    
    socket.on('host-changed', ({ newHostId }) => {
        console.log('New host is:', newHostId);
        setHostId(newHostId);
        if (user && newHostId === user.id) {
            setCurrentInfo("You are now the host!");
        }
    });

    socket.on('game-started', (data) => {
        console.log('Game started event:', data);
        setGameState(prev => ({ ...prev, phase: data.phase })); // Server sends 'playing-question'
        // Question and imposter status will come via 'new-round'
        clearMessages();
    });

    socket.on('new-round', (data) => {
        console.log('New round data:', data);
        setGameState({ phase: data.gameState.phase, roundNumber: data.roundNumber });
        setQuestion(data.question);
        setIsImposter(data.isImposter);
        setAnswers([]); // Clear answers for the new round
        setCurrentQuestionNormal(''); // Clear normal question until reveal
        clearMessages();
    });
    
    socket.on('answer-update', (data) => {
        // data could be { submittedCount, totalPlayers }
        // For now, not directly using this for rich UI, relying on phase changes
        console.log("Answer update received:", data);
    });

    socket.on('all-answers-submitted', (data) => {
        console.log('All answers submitted:', data);
        setAnswers(data.answers);
        setCurrentQuestionNormal(data.currentQuestionNormal);
        setGameState(prev => ({ ...prev, phase: data.gameState.phase })); // Should be 'playing-reveal'
    });

    socket.on('play-tts-text', ({ text }) => {
        console.log('Received request to play TTS for:', text);
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            // Optional: configure voice, pitch, rate
            // utterance.voice = speechSynthesis.getVoices().find(voice => voice.name === 'Google UK English Female'); // Example
            speechSynthesis.speak(utterance);
        } else {
            setCurrentError('Your browser does not support Text-to-Speech.');
        }
    });
    
    socket.on('game-state-update', (data) => {
        // Generic state update, e.g., phase change after TTS
        console.log('Game state update:', data);
        if (data.phase) {
            setGameState(prev => ({ ...prev, phase: data.phase }));
        }
        if (data.hostId) {
            setHostId(data.hostId);
        }
    });

    socket.on('game-error', ({ message }) => {
        console.error('Game Error:', message);
        setCurrentError(message);
    });
    
    socket.on('error-message', ({ message }) => { // More generic errors
        console.error('Server Error:', message);
        setCurrentError(message);
    });


    return () => {
      // Clean up listeners when component unmounts or socket changes
      socket.off('connect');
      socket.off('disconnect');
      socket.off('session-restored');
      socket.off('session-restore-failed');
      socket.off('join-success');
      socket.off('lobby-update');
      socket.off('host-changed');
      socket.off('game-started');
      socket.off('new-round');
      socket.off('answer-update');
      socket.off('all-answers-submitted');
      socket.off('play-tts-text');
      socket.off('game-state-update');
      socket.off('game-error');
      socket.off('error-message');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, gameState.phase]); // Add other dependencies if they cause issues, but be careful with re-running useEffect too often


  // --- Client Actions ---
  const startGame = () => {
    clearMessages();
    if (user && user.id === hostId && players.length >= MIN_PLAYERS_TO_START) {
      socket.emit('start-game');
    } else if (players.length < MIN_PLAYERS_TO_START) {
      setCurrentError(`Need at least ${MIN_PLAYERS_TO_START} players to start.`);
    }
  };

  const submitAnswer = (answerText) => {
    clearMessages();
    socket.emit('submit-answer', { answer: answerText });
  };

  const handleContinueTTS = () => {
    clearMessages();
    socket.emit('host-continue-tts');
  };

  const handleNextRound = () => {
    clearMessages();
    socket.emit('host-next-round');
  };


  if (needsUsername || !user) {
    return (
      <div className="App">
        <h1>Imposter Game</h1>
        {currentError && <p className="error-message">{currentError}</p>}
        <UsernamePrompt onUsernameSubmit={handleUsernameSubmit} />
      </div>
    );
  }

  return (
    <div className="App">
      <h1>Imposter Game</h1>
      <p>Welcome, {user.username}! (ID: {user.id.substring(0,6)}...)
         {user.id === hostId && <span className="host-badge"> Host</span>}
      </p>

      {currentError && <p className="error-message" onClick={() => setCurrentError('')}>{currentError} (click to dismiss)</p>}
      {currentInfo && <p className="info-message" onClick={() => setCurrentInfo('')}>{currentInfo} (click to dismiss)</p>}

      {gameState.phase === 'lobby' && (
        <Lobby
          players={players}
          hostId={hostId}
          currentUserId={user.id}
          onStartGame={startGame}
          onLeaveGame={handleLeaveGame}
        />
      )}

      { (gameState.phase === 'playing-question' || 
         gameState.phase === 'playing-reveal' || 
         gameState.phase === 'round-end') && (
        <Game
          gameState={gameState}
          question={question}
          isImposter={isImposter}
          answers={answers}
          currentUserId={user.id}
          hostId={hostId}
          onSubmitAnswer={submitAnswer}
          onContinueTTS={handleContinueTTS}
          onNextRound={handleNextRound}
          onLeaveGame={handleLeaveGame}
          currentQuestionNormal={currentQuestionNormal}
        />
      )}
    </div>
  );
}

export default App;