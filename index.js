const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt"); // For password hashing

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("public"));

const rooms = {}; // Store room data

// Winning combinations
const winningCombinations = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8], // Rows
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8], // Columns
    [0, 4, 8],
    [2, 4, 6], // Diagonals
];

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // When a player creates a room
    socket.on("createRoom", async ({ password, username }) => {
        const roomId = uuidv4(); // Generate a unique room ID
        const hashedPassword = await bcrypt.hash(password, 10); // Hash the password

        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [],
                password: hashedPassword,
                usernames: [],
                currentTurn: "X",
                board: Array(9).fill(null),
            };
        }

        const room = rooms[roomId];
        room.players.push(socket.id);
        room.usernames.push(username);
        socket.join(roomId);

        socket.emit("roomJoined", {
            message: "Room created successfully!",
            symbol: "X",
            roomId,
        });
    });

    // When a player joins a room
    socket.on("joinRoom", ({ roomId, password, username }) => {
        const room = rooms[roomId];

        // Check if room exists
        if (!room) {
            socket.emit("errorMessage", { message: "Room does not exist!" });
            return;
        }

        // Check if the room password is correct
        if (room.password !== password) {
            socket.emit("errorMessage", { message: "Incorrect password!" });
            return;
        }

        // Check if room is full (already 2 players)
        if (room.players.length >= 2) {
            socket.emit("errorMessage", { message: "Room is full!" });
            return;
        }

        // Add player to the room
        room.players.push(socket.id);
        room.usernames.push(username);
        socket.join(roomId);

        // Notify the player and assign a symbol ('O' for second player)
        socket.emit("roomJoined", {
            message: "Joined room successfully!",
            symbol: room.players.length === 1 ? "X" : "O",
        });

        // Start the game when 2 players have joined
        if (room.players.length === 2) {
            io.to(roomId).emit("startGame", {
                message: "Game Ready!",
                usernames: room.usernames,
                currentTurn: room.currentTurn,
            });
        } else {
            socket.emit("waitingMessage", {
                message: "Waiting for an opponent...",
            });
        }
    });

    // Handle player moves
    socket.on("makeMove", ({ roomId, index, symbol }) => {
        const room = rooms[roomId];

        if (room.currentTurn === symbol && room.board[index] === null) {
            room.board[index] = symbol;

            // First, render the board with the new move
            io.to(roomId).emit("turnUpdate", {
                currentTurn: room.currentTurn,
                board: room.board,
            });

            // Then check for win or tie
            const winner = checkWinner(room.board);
            if (winner) {
                setTimeout(() => {
                    io.to(roomId).emit("gameOver", {
                        result: `${symbol} wins!`,
                        winner: symbol,
                    });
                    promptNewGame(roomId);
                }, 500); // Add slight delay to show the last move
                return;
            } else if (room.board.every((cell) => cell !== null)) {
                setTimeout(() => {
                    io.to(roomId).emit("gameOver", { result: "It's a tie!" });
                    promptNewGame(roomId);
                }, 500); // Add slight delay to show the last move
                return;
            }

            // Switch turn and continue game
            room.currentTurn = room.currentTurn === "X" ? "O" : "X";
            io.to(roomId).emit("turnUpdate", {
                currentTurn: room.currentTurn,
                board: room.board,
            });
        }
    });

    // Offer to play again or leave after the game ends
    function promptNewGame(roomId) {
        io.to(roomId).emit("playAgainPrompt", {
            message: "Do you want to play again?",
        });

        // Reset the room but wait for players to either restart or leave
        rooms[roomId].board = Array(9).fill(null);
        rooms[roomId].currentTurn = "X";
    }

    // Handle player leaving/disconnection
    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);

        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (room.players.includes(socket.id)) {
                room.players.splice(room.players.indexOf(socket.id), 1);
                room.usernames.splice(room.players.indexOf(socket.id), 1);

                io.to(roomId).emit("playerLeft", {
                    message: "Opponent left the game!",
                });

                // If both players are gone, delete the room to free up memory
                if (room.players.length === 0) {
                    delete rooms[roomId];
                }
                break;
            }
        }
    });

    // Handle restarting the game
    socket.on("restartGame", ({ roomId }) => {
        const room = rooms[roomId];
        if (room && room.players.length === 2) {
            io.to(roomId).emit("startGame", {
                message: "Game Restarted!",
                usernames: room.usernames,
                currentTurn: room.currentTurn,
            });
        }
    });
});

// Check for a winner
function checkWinner(board) {
    for (const [a, b, c] of winningCombinations) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
