import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BaseToolProps } from '../types';

// ===== SNAKE GAME =====
interface SnakeGameState {
  snake: { x: number; y: number }[];
  food: { x: number; y: number };
  direction: string;
  gameOver: boolean;
  score: number;
}

const SnakeGame = ({ onBack }: { onBack: () => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<SnakeGameState>({
    snake: [{ x: 300, y: 300 }],
    food: { x: 480, y: 480 },
    direction: 'RIGHT',
    gameOver: false,
    score: 0
  });

  const GRID_SIZE = 20;
  const CANVAS_SIZE = 600;

  const generateFood = () => ({
    x: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)) * GRID_SIZE,
    y: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)) * GRID_SIZE
  });

  const moveSnake = useCallback(() => {
    if (gameState.gameOver) return;

    setGameState(prev => {
      const newSnake = [...prev.snake];
      const head = { ...newSnake[0] };

      switch (prev.direction) {
        case 'UP': head.y -= GRID_SIZE; break;
        case 'DOWN': head.y += GRID_SIZE; break;
        case 'LEFT': head.x -= GRID_SIZE; break;
        case 'RIGHT': head.x += GRID_SIZE; break;
      }

      // Check wall collision
      if (head.x < 0 || head.x >= CANVAS_SIZE || head.y < 0 || head.y >= CANVAS_SIZE) {
        return { ...prev, gameOver: true };
      }

      // Check self collision
      if (newSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
        return { ...prev, gameOver: true };
      }

      newSnake.unshift(head);

      // Check food collision
      if (head.x === prev.food.x && head.y === prev.food.y) {
        return {
          ...prev,
          snake: newSnake,
          food: generateFood(),
          score: prev.score + 10
        };
      } else {
        newSnake.pop();
        return { ...prev, snake: newSnake };
      }
    });
  }, [gameState.gameOver]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameState.gameOver) return;

      setGameState(prev => {
        switch (e.key) {
          case 'ArrowUp': return prev.direction !== 'DOWN' ? { ...prev, direction: 'UP' } : prev;
          case 'ArrowDown': return prev.direction !== 'UP' ? { ...prev, direction: 'DOWN' } : prev;
          case 'ArrowLeft': return prev.direction !== 'RIGHT' ? { ...prev, direction: 'LEFT' } : prev;
          case 'ArrowRight': return prev.direction !== 'LEFT' ? { ...prev, direction: 'RIGHT' } : prev;
          default: return prev;
        }
      });
    };

    window.addEventListener('keydown', handleKeyPress);
    const gameLoop = setInterval(moveSnake, 150);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      clearInterval(gameLoop);
    };
  }, [moveSnake]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw snake
    ctx.fillStyle = '#0f0';
    gameState.snake.forEach(segment => {
      ctx.fillRect(segment.x, segment.y, GRID_SIZE, GRID_SIZE);
    });

    // Draw food
    ctx.fillStyle = '#f00';
    ctx.fillRect(gameState.food.x, gameState.food.y, GRID_SIZE, GRID_SIZE);
  }, [gameState]);

  const resetGame = () => {
    setGameState({
      snake: [{ x: 300, y: 300 }],
      food: generateFood(),
      direction: 'RIGHT',
      gameOver: false,
      score: 0
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h2 className="text-3xl font-bold mb-4 text-green-400">🐍 Snake Game</h2>
      <div className="mb-4 text-xl text-white">Score: {gameState.score}</div>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="border-2 border-green-400 mb-4"
      />
      {gameState.gameOver && (
        <div className="text-center mb-4">
          <div className="text-red-400 text-xl mb-2">Game Over!</div>
          <button onClick={resetGame} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            Play Again
          </button>
        </div>
      )}
      <div className="text-center mb-4 text-white">
        <div>Use arrow keys to move</div>
      </div>
      <button onClick={onBack} className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
        ← Back to Menu
      </button>
    </div>
  );
};

// ===== 2048 GAME =====
const Game2048 = ({ onBack }: { onBack: () => void }) => {
  const [board, setBoard] = useState<number[][]>(() => {
    const newBoard = Array(4).fill(null).map(() => Array(4).fill(0));
    addRandomTile(newBoard);
    addRandomTile(newBoard);
    return newBoard;
  });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  function addRandomTile(board: number[][]) {
    const emptyTiles = [];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (board[i][j] === 0) emptyTiles.push([i, j]);
      }
    }
    if (emptyTiles.length > 0) {
      const [row, col] = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
      board[row][col] = Math.random() < 0.9 ? 2 : 4;
    }
  }

  function canMove(board: number[][]) {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (board[i][j] === 0) return true;
        if (j < 3 && board[i][j] === board[i][j + 1]) return true;
        if (i < 3 && board[i][j] === board[i + 1][j]) return true;
      }
    }
    return false;
  }

  function moveLeft(board: number[][]) {
    let moved = false;
    let points = 0;

    for (let i = 0; i < 4; i++) {
      const row = board[i].filter(val => val !== 0);
      for (let j = 0; j < row.length - 1; j++) {
        if (row[j] === row[j + 1]) {
          row[j] *= 2;
          points += row[j];
          row[j + 1] = 0;
          j++;
        }
      }
      const newRow = row.filter(val => val !== 0);
      while (newRow.length < 4) newRow.push(0);

      for (let j = 0; j < 4; j++) {
        if (board[i][j] !== newRow[j]) moved = true;
        board[i][j] = newRow[j];
      }
    }
    return { moved, points };
  }

  function rotateBoard(board: number[][]) {
    const newBoard = Array(4).fill(null).map(() => Array(4).fill(0));
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        newBoard[j][3 - i] = board[i][j];
      }
    }
    return newBoard;
  }

  const handleMove = (direction: string) => {
    if (gameOver) return;

    const newBoard = board.map(row => [...row]);
    let moved = false;
    let points = 0;

    switch (direction) {
      case 'LEFT':
        ({ moved, points } = moveLeft(newBoard));
        break;
      case 'RIGHT':
        const rotatedRight = rotateBoard(rotateBoard(newBoard));
        ({ moved, points } = moveLeft(rotatedRight));
        if (moved) {
          const finalBoard = rotateBoard(rotateBoard(rotatedRight));
          setBoard(finalBoard);
        }
        break;
      case 'UP':
        const rotatedUp = rotateBoard(rotateBoard(rotateBoard(newBoard)));
        ({ moved, points } = moveLeft(rotatedUp));
        if (moved) {
          const finalBoard = rotateBoard(rotatedUp);
          setBoard(finalBoard);
        }
        break;
      case 'DOWN':
        const rotatedDown = rotateBoard(newBoard);
        ({ moved, points } = moveLeft(rotatedDown));
        if (moved) {
          const finalBoard = rotateBoard(rotateBoard(rotateBoard(rotatedDown)));
          setBoard(finalBoard);
        }
        break;
    }

    if (moved && (direction === 'LEFT')) {
      addRandomTile(newBoard);
      setBoard(newBoard);
      setScore(prev => prev + points);

      if (!canMove(newBoard)) {
        setGameOver(true);
      }
    }
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft': handleMove('LEFT'); break;
        case 'ArrowRight': handleMove('RIGHT'); break;
        case 'ArrowUp': handleMove('UP'); break;
        case 'ArrowDown': handleMove('DOWN'); break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [board, gameOver]);

  const resetGame = () => {
    const newBoard = Array(4).fill(null).map(() => Array(4).fill(0));
    addRandomTile(newBoard);
    addRandomTile(newBoard);
    setBoard(newBoard);
    setScore(0);
    setGameOver(false);
  };

  const getTileColor = (value: number) => {
    const colors: { [key: number]: string } = {
      0: 'bg-gray-300',
      2: 'bg-blue-100 text-gray-800',
      4: 'bg-blue-200 text-gray-800',
      8: 'bg-orange-200 text-white',
      16: 'bg-orange-400 text-white',
      32: 'bg-orange-500 text-white',
      64: 'bg-red-400 text-white',
      128: 'bg-yellow-400 text-white',
      256: 'bg-yellow-500 text-white',
      512: 'bg-yellow-600 text-white',
      1024: 'bg-green-500 text-white',
      2048: 'bg-green-600 text-white'
    };
    return colors[value] || 'bg-purple-600 text-white';
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h2 className="text-3xl font-bold mb-4 text-yellow-400">🎯 2048</h2>
      <div className="mb-4 text-xl text-white">Score: {score}</div>
      <div className="grid grid-cols-4 gap-3 mb-4 p-6 bg-gray-600 rounded-lg">
        {board.flat().map((value, index) => (
          <div
            key={index}
            className={`w-24 h-24 flex items-center justify-center rounded font-bold text-xl ${getTileColor(value)}`}
          >
            {value || ''}
          </div>
        ))}
      </div>
      {gameOver && (
        <div className="text-center mb-4">
          <div className="text-red-400 text-xl mb-2">Game Over!</div>
          <button onClick={resetGame} className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
            Play Again
          </button>
        </div>
      )}
      <div className="text-center mb-4 text-white">
        <div>Use arrow keys to move tiles</div>
        <div>Combine same numbers to reach 2048!</div>
      </div>
      <button onClick={onBack} className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
        ← Back to Menu
      </button>
    </div>
  );
};

// ===== MEMORY MATCH GAME =====
const MemoryGame = ({ onBack }: { onBack: () => void }) => {
  const [cards, setCards] = useState<{ id: number; emoji: string; flipped: boolean; matched: boolean }[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [gameWon, setGameWon] = useState(false);

  const emojis = ['🎮', '🚀', '⭐', '🎯', '🔥', '💎', '🌟', '🎪'];

  useEffect(() => {
    resetGame();
  }, []);

  const resetGame = () => {
    const gameCards = [...emojis, ...emojis]
      .sort(() => Math.random() - 0.5)
      .map((emoji, index) => ({
        id: index,
        emoji,
        flipped: false,
        matched: false
      }));
    setCards(gameCards);
    setFlippedCards([]);
    setMoves(0);
    setGameWon(false);
  };

  const flipCard = (id: number) => {
    if (flippedCards.length === 2) return;
    if (cards[id].flipped || cards[id].matched) return;

    const newFlippedCards = [...flippedCards, id];
    setFlippedCards(newFlippedCards);

    setCards(prev => prev.map(card =>
      card.id === id ? { ...card, flipped: true } : card
    ));

    if (newFlippedCards.length === 2) {
      setMoves(prev => prev + 1);
      setTimeout(() => {
        const [first, second] = newFlippedCards;
        if (cards[first].emoji === cards[second].emoji) {
          setCards(prev => prev.map(card =>
            card.id === first || card.id === second
              ? { ...card, matched: true }
              : card
          ));

          // Check if game is won
          if (cards.filter(card => !card.matched && card.id !== first && card.id !== second).length === 0) {
            setGameWon(true);
          }
        } else {
          setCards(prev => prev.map(card =>
            card.id === first || card.id === second
              ? { ...card, flipped: false }
              : card
          ));
        }
        setFlippedCards([]);
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h2 className="text-3xl font-bold mb-4 text-purple-400">🧠 Memory Match</h2>
      <div className="mb-4 text-xl text-white">Moves: {moves}</div>
      <div className="grid grid-cols-4 gap-4 mb-4">
        {cards.map(card => (
          <div
            key={card.id}
            onClick={() => flipCard(card.id)}
            className={`w-28 h-28 flex items-center justify-center text-3xl rounded-lg cursor-pointer transition-all ${card.flipped || card.matched
                ? 'bg-blue-500 text-white'
                : 'bg-gray-600 hover:bg-gray-500'
              }`}
          >
            {card.flipped || card.matched ? card.emoji : '?'}
          </div>
        ))}
      </div>
      {gameWon && (
        <div className="text-center mb-4">
          <div className="text-green-400 text-xl mb-2">You Won! 🎉</div>
          <div className="text-white mb-2">Completed in {moves} moves!</div>
          <button onClick={resetGame} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
            Play Again
          </button>
        </div>
      )}
      <div className="text-center mb-4 text-white">
        <div>Find matching pairs!</div>
      </div>
      <button onClick={onBack} className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
        ← Back to Menu
      </button>
    </div>
  );
};

// ===== REACTION TIMER GAME =====
const ReactionGame = ({ onBack }: { onBack: () => void }) => {
  const [gameState, setGameState] = useState<'waiting' | 'ready' | 'go' | 'clicked' | 'too-early'>('waiting');
  const [startTime, setStartTime] = useState(0);
  const [reactionTime, setReactionTime] = useState(0);
  const [bestTime, setBestTime] = useState<number | null>(null);

  const startGame = () => {
    setGameState('ready');
    const delay = Math.random() * 4000 + 1000; // 1-5 seconds
    setTimeout(() => {
      setGameState('go');
      setStartTime(Date.now());
    }, delay);
  };

  const handleClick = () => {
    if (gameState === 'ready') {
      setGameState('too-early');
      setTimeout(() => setGameState('waiting'), 2000);
    } else if (gameState === 'go') {
      const time = Date.now() - startTime;
      setReactionTime(time);
      setGameState('clicked');
      if (!bestTime || time < bestTime) {
        setBestTime(time);
      }
      setTimeout(() => setGameState('waiting'), 3000);
    }
  };

  const getBackgroundColor = () => {
    switch (gameState) {
      case 'ready': return 'bg-red-500';
      case 'go': return 'bg-green-500';
      case 'too-early': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const getMessage = () => {
    switch (gameState) {
      case 'waiting': return 'Click to Start';
      case 'ready': return 'Wait for green...';
      case 'go': return 'CLICK NOW!';
      case 'clicked': return `${reactionTime}ms`;
      case 'too-early': return 'Too early!';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h2 className="text-3xl font-bold mb-4 text-green-400">⚡ Reaction Timer</h2>
      {bestTime && (
        <div className="mb-4 text-xl text-white">Best: {bestTime}ms</div>
      )}
      <div
        onClick={handleClick}
        className={`w-96 h-96 flex items-center justify-center text-4xl font-bold text-white rounded-lg cursor-pointer transition-all ${getBackgroundColor()}`}
      >
        {getMessage()}
      </div>
      <div className="text-center mt-6 text-white">
        <div>Wait for green, then click as fast as you can!</div>
        <div className="text-sm mt-2">Good: &lt;300ms | Great: &lt;200ms | Amazing: &lt;150ms</div>
      </div>
      <button onClick={onBack} className="mt-6 px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
        ← Back to Menu
      </button>
    </div>
  );
};

// ===== PING PONG GAME =====
const PingPongGame = ({ onBack }: { onBack: () => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const gameRef = useRef({
    ball: { x: 400, y: 250, dx: 5, dy: 3, size: 10 },
    paddle: { x: 350, y: 550, width: 100, height: 10 },
    bricks: [] as { x: number; y: number; width: number; height: number }[]
  });

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  useEffect(() => {
    // Initialize bricks
    const bricks = [];
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 6; j++) {
        bricks.push({
          x: i * 80,
          y: j * 25 + 50,
          width: 75,
          height: 20
        });
      }
    }
    gameRef.current.bricks = bricks;
    setScore(0);
    setGameOver(false);
  }, []);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { ball, paddle, bricks } = gameRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Move ball
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Ball wall collision
    if (ball.x <= ball.size || ball.x >= CANVAS_WIDTH - ball.size) {
      ball.dx = -ball.dx;
    }
    if (ball.y <= ball.size) {
      ball.dy = -ball.dy;
    }

    // Ball paddle collision
    if (ball.y + ball.size >= paddle.y &&
      ball.x >= paddle.x &&
      ball.x <= paddle.x + paddle.width &&
      ball.dy > 0) {
      ball.dy = -ball.dy;
    }

    // Ball bottom wall (game over)
    if (ball.y >= CANVAS_HEIGHT) {
      setGameOver(true);
      return;
    }

    // Ball brick collision
    for (let i = bricks.length - 1; i >= 0; i--) {
      const brick = bricks[i];
      if (ball.x >= brick.x && ball.x <= brick.x + brick.width &&
        ball.y >= brick.y && ball.y <= brick.y + brick.height) {
        ball.dy = -ball.dy;
        bricks.splice(i, 1);
        setScore(prev => prev + 10);
        break;
      }
    }

    // Check win condition
    if (bricks.length === 0) {
      setGameOver(true);
    }

    // Draw ball
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fill();

    // Draw paddle
    ctx.fillStyle = '#0f0';
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);

    // Draw bricks
    ctx.fillStyle = '#f80';
    bricks.forEach(brick => {
      ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameOver) return;

    const interval = setInterval(gameLoop, 16);
    return () => clearInterval(interval);
  }, [gameLoop, gameOver]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      gameRef.current.paddle.x = Math.max(0, Math.min(x - 50, CANVAS_WIDTH - 100));
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const resetGame = () => {
    gameRef.current.ball = { x: 400, y: 250, dx: 5, dy: 3, size: 10 };
    gameRef.current.paddle = { x: 350, y: 550, width: 100, height: 10 };

    const bricks = [];
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 6; j++) {
        bricks.push({
          x: i * 80,
          y: j * 25 + 50,
          width: 75,
          height: 20
        });
      }
    }
    gameRef.current.bricks = bricks;
    setScore(0);
    setGameOver(false);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h2 className="text-3xl font-bold mb-4 text-orange-400">🏓 Breakout</h2>
      <div className="mb-4 text-xl text-white">Score: {score}</div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-orange-400 mb-4 bg-black"
      />
      {gameOver && (
        <div className="text-center mb-4">
          <div className="text-green-400 text-xl mb-2">
            {gameRef.current.bricks.length === 0 ? 'You Won! 🎉' : 'Game Over!'}
          </div>
          <button onClick={resetGame} className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
            Play Again
          </button>
        </div>
      )}
      <div className="text-center mb-4 text-white">
        <div>Move mouse to control paddle</div>
      </div>
      <button onClick={onBack} className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
        ← Back to Menu
      </button>
    </div>
  );
};

// ===== TYPING SPEED GAME =====
const TypingGame = ({ onBack }: { onBack: () => void }) => {
  const [text, setText] = useState('');
  const [userInput, setUserInput] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [bgClass, setBgClass] = useState('bg-gray-800');
  const [gameOver, setGameOver] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const CODE_SNIPPETS = [
    "function binarySearch(arr, target) { let left = 0; let right = arr.length - 1; while (left <= right) { const mid = Math.floor((left + right) / 2); if (arr[mid] === target) return mid; if (arr[mid] < target) left = mid + 1; else right = mid - 1; } return -1; }",
    "const debounce = (func, wait) => { let timeout; return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func(...args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); }; };",
    "useEffect(() => { const subscription = props.source.subscribe(); return () => { subscription.unsubscribe(); }; }, [props.source]);",
    "class Node { constructor(value) { this.value = value; this.next = null; } } class LinkedList { constructor() { this.head = null; this.size = 0; } add(element) { const node = new Node(element); let current; if (this.head == null) this.head = node; else { current = this.head; while (current.next) { current = current.next; } current.next = node; } this.size++; } }",
    "SELECT u.username, o.order_date, SUM(oi.price * oi.quantity) as total_amount FROM users u JOIN orders o ON u.id = o.user_id JOIN order_items oi ON o.id = oi.order_id GROUP BY u.id, o.id ORDER BY o.order_date DESC LIMIT 10;"
  ];

  useEffect(() => {
    startNewGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startNewGame = () => {
    const randomText = CODE_SNIPPETS[Math.floor(Math.random() * CODE_SNIPPETS.length)];
    setText(randomText);
    setUserInput('');
    setStartTime(null);
    setWpm(0);
    setAccuracy(100);
    setGameOver(false);
    setTimeElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const input = e.target.value;

    if (!startTime) {
      setStartTime(Date.now());
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }

    setUserInput(input);

    // Calculate accuracy
    let errors = 0;
    for (let i = 0; i < input.length; i++) {
      if (input[i] !== text[i]) errors++;
    }
    const currentAccuracy = Math.max(0, Math.floor(((input.length - errors) / input.length) * 100));
    setAccuracy(isNaN(currentAccuracy) ? 100 : currentAccuracy);

    // Provide visual feedback
    if (input.length > 0 && text.startsWith(input)) {
      setBgClass('bg-gray-800 border-green-500');
    } else if (input.length > 0) {
      setBgClass('bg-gray-800 border-red-500');
    } else {
      setBgClass('bg-gray-800 border-gray-600');
    }

    // Check completion
    if (input === text) {
      if (timerRef.current) clearInterval(timerRef.current);
      const timeInMinutes = (Date.now() - (startTime || Date.now())) / 60000;
      const words = text.length / 5;
      const finalWpm = Math.round(words / timeInMinutes);
      setWpm(finalWpm);
      setGameOver(true);
      setBgClass('bg-green-900/30 border-green-400');
    }
  };

  const renderText = () => {
    return text.split('').map((char, index) => {
      let color = 'text-gray-400';
      if (index < userInput.length) {
        color = userInput[index] === char ? 'text-green-400' : 'text-red-400 bg-red-900/30';
      } else if (index === userInput.length) {
        color = 'text-blue-400 underline decoration-2 decoration-blue-400 underline-offset-4';
      }
      return <span key={index} className={color}>{char}</span>;
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 max-w-4xl mx-auto w-full">
      <h2 className="text-3xl font-bold mb-6 text-cyan-400 font-mono">⌨️ Code Typer</h2>

      <div className="flex justify-between w-full mb-4 font-mono text-xl">
        <div className="text-white">Time: {timeElapsed}s</div>
        <div className={`text-white ${accuracy < 90 ? 'text-red-400' : 'text-green-400'}`}>Accuracy: {accuracy}%</div>
      </div>

      <div className="relative w-full mb-6 font-mono text-lg bg-gray-900 p-6 rounded-xl border border-gray-700 shadow-2xl leading-relaxed">
        {renderText()}
      </div>

      {!gameOver ? (
        <textarea
          value={userInput}
          onChange={handleInput}
          className={`w-full h-32 p-4 rounded-xl border-2 ${bgClass} text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
          placeholder="Start typing the code above..."
          autoFocus
          spellCheck={false}
        />
      ) : (
        <div className="text-center animate-bounce-in">
          <div className="text-5xl font-bold text-green-400 mb-2">{wpm} WPM</div>
          <div className="text-xl text-gray-300 mb-6"> Amazing coding speed! 🚀</div>
          <button
            onClick={startNewGame}
            className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-bold transition-transform hover:scale-105 mr-4"
          >
            Play Again
          </button>
        </div>
      )}

      <button onClick={onBack} className="mt-8 px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 font-mono">
        ← Back to Menu
      </button>
    </div>
  );
};

// ===== MAIN GAMES MENU =====
const GAMES = [
  { name: '🐍 Snake', key: 'snake', available: true, description: 'Classic snake game' },
  { name: '🎯 2048', key: '2048', available: true, description: 'Number puzzle game' },
  { name: '⌨️ Code Typer', key: 'typing', available: true, description: 'Test coding speed' }, // New Game
  { name: '🧠 Memory Match', key: 'memory', available: true, description: 'Find matching pairs' },
  { name: '⚡ Reaction Timer', key: 'reaction', available: true, description: 'Test your reflexes' },
  { name: '🏓 Breakout', key: 'breakout', available: true, description: 'Brick breaking game' },
];

const retroFont = {
  fontFamily: '"Courier New", "Monaco", "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier", monospace',
};

const WaitingRoom: React.FC<BaseToolProps> = () => {
  const [selected, setSelected] = useState(0);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeGame) return; // Don't handle menu keys if in a game
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        setSelected(prev => (prev === 0 ? GAMES.length - 1 : prev - 1));
      } else if (e.key === 'ArrowDown') {
        setSelected(prev => (prev === GAMES.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'Enter') {
        const game = GAMES[selected];
        if (game.available) {
          setActiveGame(game.key);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected, activeGame]);

  // Render active game
  if (activeGame) {
    const gameComponents = {
      'snake': <SnakeGame onBack={() => setActiveGame(null)} />,
      '2048': <Game2048 onBack={() => setActiveGame(null)} />,
      'memory': <MemoryGame onBack={() => setActiveGame(null)} />,
      'reaction': <ReactionGame onBack={() => setActiveGame(null)} />,
      'breakout': <PingPongGame onBack={() => setActiveGame(null)} />,
      'typing': <TypingGame onBack={() => setActiveGame(null)} />
    };

    return (
      <div className="h-full w-full bg-black text-white">
        {gameComponents[activeGame as keyof typeof gameComponents]}
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="h-full w-full flex flex-col items-center justify-center bg-black text-white"
      style={{ minHeight: '100vh' }}
    >
      <div className="mb-12 flex flex-col items-center">
        <div
          className="text-6xl md:text-7xl text-pink-400 drop-shadow-lg mb-6 animate-pulse"
          style={{ letterSpacing: '0.1em', ...retroFont }}
        >
          🕹️ Retro Arcade
        </div>
        <div className="text-green-300 text-3xl md:text-4xl tracking-widest mb-6" style={retroFont}>
          Developer Break Room
        </div>
        <div className="text-yellow-300 text-xl mb-6" style={retroFont}>
          Waiting for a CI/CD pipeline to deploy? Or just want to take a break?<br />
          <span style={{ display: 'block', textAlign: 'center' }}>Use ↑ ↓ to select, Enter to play</span>
        </div>
      </div>

      <div
        className="rounded-3xl border-8 border-pink-400 shadow-2xl px-12 py-8 bg-gradient-to-br from-gray-900 to-black flex flex-col items-center"
        style={{ minWidth: 600, maxWidth: 800 }}
      >
        {GAMES.map((game, idx) => (
          <div
            key={game.key}
            className={`flex flex-col items-center justify-center px-8 py-6 my-3 rounded-xl transition-all duration-150 cursor-pointer
              ${selected === idx
                ? 'bg-pink-600/80 text-white shadow-lg scale-105 neon-glow'
                : 'bg-gray-800 text-pink-200 hover:bg-gray-700'
              }`}
            style={{
              fontSize: '1.5rem',
              border: selected === idx ? '2px solid #fff' : '2px solid transparent',
              ...retroFont,
              filter: selected === idx ? 'drop-shadow(0 0 12px #ff00cc)' : 'none',
              minWidth: '400px'
            }}
            onClick={() => {
              setSelected(idx);
              if (game.available) {
                setActiveGame(game.key);
              }
            }}
          >
            <span className="mb-2">{game.name}</span>
            <span className="text-sm opacity-70" style={{ fontSize: '0.7rem' }}>
              {game.description}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-16 text-pink-300 text-xl opacity-70" style={retroFont}>
        🎮 Take a Break & Have Fun! 🎮
      </div>

      <style>{`
        .neon-glow {
          box-shadow: 0 0 16px #ff00cc, 0 0 32px #ff00cc, 0 0 64px #ff00cc;
        }
      `}</style>
    </div>
  );
};

export default WaitingRoom; 