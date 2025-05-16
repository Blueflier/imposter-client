import React, { useState, useEffect, useRef } from 'react';

function Game({
  gameState,
  question,
  isImposter,
  answers,
  currentUserId,
  hostId,
  onSubmitAnswer,
  onContinueTTS,
  onNextRound,
  onLeaveGame,
  currentQuestionNormal // Only available after all answers submitted
}) {
  const [answerText, setAnswerText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [localAnswers, setLocalAnswers] = useState([]);

  const isHost = currentUserId === hostId;
  const prevGameStatePhase = useRef(gameState.phase);

  useEffect(() => {
    // Reset submitted state and answer text when a new round starts or phase changes from reveal/end
    if ( (gameState.phase === 'playing-question' && prevGameStatePhase.current !== 'playing-question') || 
         (gameState.roundNumber > (prevGameStatePhase.current?.roundNumber || 0) ) ) {
        setSubmitted(false);
        setAnswerText('');
        setLocalAnswers([]); // Clear displayed answers for new round
    }
    prevGameStatePhase.current = gameState.phase;
     // If answers are passed (e.g., on rejoin or when all submitted), update localAnswers
    if (answers && answers.length > 0) {
        setLocalAnswers(answers);
    }

  }, [gameState.phase, gameState.roundNumber, answers]);


  const handleSubmit = (e) => {
    e.preventDefault();
    if (answerText.trim() && !submitted) {
      onSubmitAnswer(answerText.trim());
      setSubmitted(true);
    }
  };
  
  // Update localAnswers when the global `answers` prop updates from server (e.g. all-answers-submitted)
  useEffect(() => {
    if (gameState.phase === 'playing-reveal' || gameState.phase === 'round-end') {
      setLocalAnswers(answers || []);
    }
  }, [answers, gameState.phase]);


  return (
    <div className="game-screen">
      <h2>Round {gameState.roundNumber}</h2>
      {isImposter && <p className="imposter-text">You are the Imposter!</p>}
      
      <div className="game-question">
        <p><strong>Your Question:</strong></p>
        <p>{question}</p>
      </div>

      {gameState.phase === 'playing-question' && !submitted && (
        <form onSubmit={handleSubmit}>
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="Type your answer here..."
            rows="4"
            required
          />
          <button type="submit">Submit Answer</button>
        </form>
      )}

      {gameState.phase === 'playing-question' && submitted && (
        <p className="game-status">Your answer is submitted! Waiting for other players...</p>
      )}

      {(gameState.phase === 'playing-reveal' || gameState.phase === 'round-end') && (
        <div className="answers-container">
          <h3>All Answers:</h3>
          {currentQuestionNormal && gameState.phase !== 'playing-question' && (
            <p className="info-message"><em>The **Normal Question** was: "{currentQuestionNormal}"</em></p>
          )}
          {localAnswers.length > 0 ? localAnswers.map((ans, index) => (
            <div key={index} className="answer-item">
              <strong>{ans.username}:</strong> {ans.answer}
            </div>
          )) : <p>Waiting for answers to be revealed...</p>}
        </div>
      )}

      {isHost && gameState.phase === 'playing-reveal' && (
        <button onClick={onContinueTTS} className="host-button">Continue (Play Question Audio)</button>
      )}
      
      {isHost && gameState.phase === 'round-end' && (
        <button onClick={onNextRound} className="host-button">Next Round</button>
      )}
      
      {!isHost && gameState.phase === 'playing-reveal' && (
        <p className="game-status">Waiting for host to play question audio...</p>
      )}
      {!isHost && gameState.phase === 'round-end' && (
        <p className="game-status">Waiting for host to start the next round...</p>
      )}
      <button onClick={onLeaveGame} className="leave-button">Leave Game</button>
    </div>
  );
}

export default Game;