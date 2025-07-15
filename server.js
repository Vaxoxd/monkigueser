const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware do parsowania JSON z większym limitem dla awatarów
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Prosta baza danych użytkowników (plik JSON)
const USERS_DB_PATH = './users.json';

function loadUsers() {
  try {
    if (fs.existsSync(USERS_DB_PATH)) {
      const data = fs.readFileSync(USERS_DB_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log('Błąd wczytywania bazy użytkowników:', error);
  }
  return {};
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(users, null, 2));
    return true;
  } catch (error) {
    console.log('Błąd zapisywania bazy użytkowników:', error);
    return false;
  }
}

// Endpoint do rejestracji
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Nazwa użytkownika i hasło są wymagane!' });
  }

  if (username.length < 3) {
    return res.status(400).json({ success: false, message: 'Nazwa użytkownika musi mieć co najmniej 3 znaki!' });
  }

  if (password.length < 4) {
    return res.status(400).json({ success: false, message: 'Hasło musi mieć co najmniej 4 znaki!' });
  }

  const users = loadUsers();

  if (users[username]) {
    return res.status(400).json({ success: false, message: 'Użytkownik o tej nazwie już istnieje!' });
  }

  // Zapisz użytkownika (w prawdziwej aplikacji hasło powinno być zahashowane)
  users[username] = {
    password: password,
    createdAt: new Date().toISOString(),
    totalPoints: 0,
    gamesPlayed: 0,
    wins: 0,
    losses: 0
  };

  if (saveUsers(users)) {
    res.json({ success: true, message: 'Konto zostało utworzone pomyślnie!' });
  } else {
    res.status(500).json({ success: false, message: 'Błąd podczas tworzenia konta!' });
  }
});

// Endpoint do logowania
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Nazwa użytkownika i hasło są wymagane!' });
  }

  const users = loadUsers();
  const user = users[username];

  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: 'Nieprawidłowa nazwa użytkownika lub hasło!' });
  }

  // Zwróć dane użytkownika (bez hasła)
  const userData = {
    username: username,
    totalPoints: user.totalPoints || 0,
    gamesPlayed: user.gamesPlayed || 0,
    wins: user.wins || 0,
    losses: user.losses || 0,
    createdAt: user.createdAt
  };

  res.json({ success: true, user: userData });
});

// Endpoint do aktualizacji punktów użytkownika
app.post('/api/update-stats', (req, res) => {
  const { username, points, gameResult } = req.body;

  if (!username) {
    return res.status(400).json({ success: false, message: 'Nazwa użytkownika jest wymagana!' });
  }

  const users = loadUsers();
  const user = users[username];

  if (!user) {
    return res.status(404).json({ success: false, message: 'Użytkownik nie znaleziony!' });
  }

  // Aktualizuj statystyki
  user.totalPoints = (user.totalPoints || 0) + (points || 0);
  user.gamesPlayed = (user.gamesPlayed || 0) + 1;

  if (gameResult === 'win') {
    user.wins = (user.wins || 0) + 1;
  } else if (gameResult === 'loss') {
    user.losses = (user.losses || 0) + 1;
  }

  if (saveUsers(users)) {
    res.json({ success: true, user: {
      username: username,
      totalPoints: user.totalPoints,
      gamesPlayed: user.gamesPlayed,
      wins: user.wins,
      losses: user.losses,
      totalExp: user.totalExp || 0
    }});
  } else {
    res.status(500).json({ success: false, message: 'Błąd podczas aktualizacji statystyk!' });
  }
});

// Endpoint do aktualizacji doświadczenia użytkownika
app.post('/api/update-exp', (req, res) => {
  const { username, exp } = req.body;

  if (!username) {
    return res.status(400).json({ success: false, message: 'Nazwa użytkownika jest wymagana!' });
  }

  const users = loadUsers();
  const user = users[username];

  if (!user) {
    return res.status(404).json({ success: false, message: 'Użytkownik nie znaleziony!' });
  }

  // Aktualizuj doświadczenie
  user.totalExp = (user.totalExp || 0) + (exp || 0);

  if (saveUsers(users)) {
    res.json({ success: true, user: {
      username: username,
      totalExp: user.totalExp
    }});
  } else {
    res.status(500).json({ success: false, message: 'Błąd podczas aktualizacji doświadczenia!' });
  }
});

// Endpoint do wyszukiwania użytkowników
app.post('/api/search-user', (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ success: false, message: 'Nazwa użytkownika jest wymagana!' });
  }

  const users = loadUsers();
  const user = users[username];

  if (!user) {
    return res.status(404).json({ success: false, message: 'Użytkownik nie znaleziony!' });
  }

  // Zwróć publiczne dane użytkownika
  res.json({ success: true, user: {
    username: username,
    totalPoints: user.totalPoints || 0,
    gamesPlayed: user.gamesPlayed || 0,
    createdAt: user.createdAt
  }});
});

// Endpoint do wysyłania zaproszeń do gry
app.post('/api/send-invitation', (req, res) => {
  const { fromUser, toUser, type } = req.body;

  if (!fromUser || !toUser || !type) {
    return res.status(400).json({ success: false, message: 'Wszystkie pola są wymagane!' });
  }

  const users = loadUsers();

  if (!users[fromUser] || !users[toUser]) {
    return res.status(404).json({ success: false, message: 'Jeden z użytkowników nie istnieje!' });
  }

  // W prawdziwej aplikacji tutaj byłaby logika zapisywania zaproszeń w bazie danych
  // Na razie zwracamy sukces - zaproszenia są obsługiwane po stronie klienta

  res.json({ success: true, message: 'Zaproszenie zostało wysłane!' });
});

// Endpoint do aktualizacji awatara użytkownika
app.post('/api/update-avatar', (req, res) => {
  const { username, avatarData } = req.body;

  if (!username || !avatarData) {
    return res.status(400).json({ success: false, message: 'Nazwa użytkownika i dane awatara są wymagane!' });
  }

  const users = loadUsers();
  const user = users[username];

  if (!user) {
    return res.status(404).json({ success: false, message: 'Użytkownik nie znaleziony!' });
  }

  // Zapisz awatar
  user.avatar = avatarData;

  if (saveUsers(users)) {
    res.json({ success: true, message: 'Awatar został zaktualizowany!' });
  } else {
    res.status(500).json({ success: false, message: 'Błąd podczas aktualizacji awatara!' });
  }
});

// Endpoint do pobierania awatara użytkownika
app.post('/api/get-avatar', (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ success: false, message: 'Nazwa użytkownika jest wymagana!' });
  }

  const users = loadUsers();
  const user = users[username];

  if (!user) {
    return res.status(404).json({ success: false, message: 'Użytkownik nie znaleziony!' });
  }

  res.json({ 
    success: true, 
    avatar: user.avatar || null 
  });
});

// Endpoint do pobierania wszystkich awatarów (dla synchronizacji)
app.get('/api/get-all-avatars', (req, res) => {
  const users = loadUsers();
  const avatars = {};

  Object.keys(users).forEach(username => {
    if (users[username].avatar) {
      avatars[username] = users[username].avatar;
    }
  });

  res.json({ success: true, avatars: avatars });
});

// Endpoint do pobierania topki graczy
app.get('/api/leaderboard', (req, res) => {
  const users = loadUsers();
  const players = [];

  Object.keys(users).forEach(username => {
    const user = users[username];
    players.push({
      username: username,
      totalPoints: user.totalPoints || 0,
      totalExp: user.totalExp || 0,
      gamesPlayed: user.gamesPlayed || 0,
      wins: user.wins || 0,
      losses: user.losses || 0
    });
  });

  // Sortuj graczy według doświadczenia (EXP) malejąco
  players.sort((a, b) => {
    if (b.totalExp !== a.totalExp) {
      return b.totalExp - a.totalExp;
    }
    // Jeśli EXP jest równe, sortuj według punktów
    return b.totalPoints - a.totalPoints;
  });

  // Zwróć tylko top 50 graczy
  const topPlayers = players.slice(0, 50);

  res.json({ success: true, players: topPlayers });
});

// Serwuj pliki statyczne
app.use(express.static('.'));

// Serwuj manifest.json i service worker
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'sw.js'));
});

const rooms = new Map();
const players = new Map();

const PORT = process.env.PORT || 3000;

// Obsługa WebSocket
io.on('connection', (socket) => {
  console.log('Gracz połączony:', socket.id);

  // Dołącz do pokoju
  socket.on('joinRoom', ({ roomCode, playerName, isHost }) => {
    console.log(`${playerName} próbuje dołączyć do pokoju ${roomCode} jako ${isHost ? 'HOST' : 'GRACZ'}`);

    if (!rooms.has(roomCode)) {
      // Utwórz nowy pokój jeśli nie istnieje
      rooms.set(roomCode, {
        players: [],
        gameState: 'waiting',
        currentRound: 1,
        maxRounds: 3,
        currentLocation: null,
        hostId: null
      });
    }

    const room = rooms.get(roomCode);

    if (room.players.length >= 2) {
      socket.emit('joinError', 'Pokój jest pełny!');
      return;
    }

    // Sprawdź czy ktoś już jest hostem
    if (isHost && room.hostId) {
      socket.emit('joinError', 'W pokoju jest już host!');
      return;
    }

    // Dodaj gracza do pokoju
    const player = {
      id: socket.id,
      name: playerName,
      score: 0,
      guess: null,
      hasGuessed: false,
      isHost: isHost
    };

    if (isHost) {
      room.hostId = socket.id;
    }

    room.players.push(player);
    players.set(socket.id, { roomCode, playerName, isHost });

    socket.join(roomCode);

    // Powiadom wszystkich w pokoju
    io.to(roomCode).emit('playerJoined', {
      players: room.players,
      gameState: room.gameState
    });

    console.log(`${playerName} dołączył do pokoju ${roomCode} jako ${isHost ? 'HOST' : 'GRACZ'}. Graczy: ${room.players.length}/2`);
  });

  // Rozpocznij grę
  socket.on('startGame', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.players.length < 2) return;

    room.gameState = 'playing';

    // Wybierz losową lokalizację
    const locations = [
      { lat: 55.6604639, lng: 12.5926069 },   // Dania
      { lat: 56.8819076, lng: 14.8004662 },   // Szwecja
      { lat: 53.3499562, lng: -6.2604593 },   // Dublin, Irlandia
      { lat: 52.4459301444923, lng: 20.666284299059825 }, // Moniek
      { lat: 50.0524666, lng: 19.9458015 },   // Kraków
      { lat: 52.2324898, lng: 21.0099867 },   // Warszawa
    ];

    room.currentLocation = locations[Math.floor(Math.random() * locations.length)];

    // Reset guessów
    room.players.forEach(p => {
      p.guess = null;
      p.hasGuessed = false;
    });

    io.to(roomCode).emit('gameStarted', {
      currentRound: room.currentRound,
      maxRounds: room.maxRounds,
      location: room.currentLocation
    });

    console.log(`Gra rozpoczęta w pokoju ${roomCode}, runda ${room.currentRound}`);
  });

  // Prześlij guess
  socket.on('submitGuess', ({ roomCode, guess }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    player.guess = guess;
    player.hasGuessed = true;

    // Powiadom innych o zgadnięciu
    socket.to(roomCode).emit('opponentGuessed', {
      playerName: player.name,
      playerId: player.id
    });

    // Sprawdź czy wszyscy zgadli
    const allGuessed = room.players.every(p => p.hasGuessed);

    if (allGuessed) {
      // Oblicz wyniki
      room.players.forEach(player => {
        if (player.guess) {
          const distance = calculateDistance(room.currentLocation, player.guess);
          const points = calculatePoints(distance);
          player.score += points;
          player.distance = distance;
          player.points = points;
        } else {
          player.distance = 20000;
          player.points = 0;
        }
      });

      // Wyślij wyniki
      io.to(roomCode).emit('roundResults', {
        players: room.players,
        location: room.currentLocation,
        currentRound: room.currentRound
      });

      // Sprawdź czy gra się skończyła
      if (room.currentRound >= room.maxRounds) {
        room.gameState = 'finished';
        const winner = room.players.reduce((prev, current) => 
          (prev.score > current.score) ? prev : current
        );

        io.to(roomCode).emit('gameEnded', {
          winner: winner,
          players: room.players
        });
      } else {
        // Następna runda
        setTimeout(() => {
          room.currentRound++;
          room.players.forEach(p => {
            p.guess = null;
            p.hasGuessed = false;
          });

          const locations = [
            { lat: 55.6604639, lng: 12.5926069 },
            { lat: 56.8819076, lng: 14.8004662 },
            { lat: 53.3499562, lng: -6.2604593 },
            { lat: 52.4459301444923, lng: 20.666284299059825 },
            { lat: 50.0524666, lng: 19.9458015 },
            { lat: 52.2324898, lng: 21.0099867 },
          ];

          room.currentLocation = locations[Math.floor(Math.random() * locations.length)];

          io.to(roomCode).emit('nextRound', {
            currentRound: room.currentRound,
            location: room.currentLocation
          });
        }, 5000);
      }
    }
  });

  // Opuść pokój
  socket.on('leaveRoom', ({ roomCode }) => {
    leaveRoom(socket, roomCode);
  });

  // Synchronizacja awatara z innymi użytkownikami
  socket.on('avatarUpdated', (data) => {
    socket.broadcast.emit('userAvatarUpdated', {
      username: data.username,
      avatar: data.avatar
    });
  });

  socket.on('disconnect', () => {
    console.log('Gracz rozłączony:', socket.id);
    const playerData = players.get(socket.id);
    if (playerData) {
      leaveRoom(socket, playerData.roomCode);
    }
  });
});

function leaveRoom(socket, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.players = room.players.filter(p => p.id !== socket.id);
  players.delete(socket.id);

  socket.leave(roomCode);

  if (room.players.length === 0) {
    rooms.delete(roomCode);
    console.log(`Pokój ${roomCode} został usunięty`);
  } else {
    io.to(roomCode).emit('playerLeft', {
      players: room.players
    });
  }
}

function calculateDistance(coord1, coord2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(coord1.lat)) *
    Math.cos(toRad(coord2.lat)) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculatePoints(km) {
  let points = Math.round(5000 - km);
  return Math.max(0, Math.min(points, 5000));
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serwer MońkiGuessr działa na porcie ${PORT}`);
  console.log(`🌐 Dostępny pod adresem: http://0.0.0.0:${PORT}`);
});
