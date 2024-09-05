const socket = io();
let currentPlayerSymbol = null;
let myTurn = false;
let roomId = null;

// Handle room creation
document.getElementById("createRoomBtn").addEventListener("click", () => {
    const username = document.getElementById("username").value;
    roomId = document.getElementById("roomId").value;
    const password = document.getElementById("password").value;

    if (validateInputs(username, roomId, password)) {
        socket.emit("createRoom", { roomId, password, username });
    }
});

// Handle joining a room
document.getElementById("joinRoomBtn").addEventListener("click", () => {
    const username = document.getElementById("username").value;
    roomId = document.getElementById("roomId").value;
    const password = document.getElementById("password").value;

    if (validateInputs(username, roomId, password)) {
        socket.emit("joinRoom", { roomId, password, username });
    }
});

// Room joined successfully
socket.on("roomJoined", (data) => {
    if (data.symbol) {
        currentPlayerSymbol = data.symbol;
        document.getElementById("status").textContent = data.message;

        document.getElementById("symbol").textContent =
            `Your symbol is ${currentPlayerSymbol}`;
        enableBoard(); // Enable the board for game play
    }
});

// Error handling (e.g., room full, incorrect password, etc.)
socket.on("errorMessage", (data) => {
    document.getElementById("status").textContent = data.message;
    disableBoard(); // Disable the board since no valid room joined
});

socket.on("startGame", (data) => {
    document.getElementById("status").textContent = "Game started!";
    document.getElementById("player1Name").textContent = data.usernames[0];
    document.getElementById("player2Name").textContent = data.usernames[1];
    updateTurnNotification(data.currentTurn);
});

// Handle player move
document.querySelectorAll(".cell").forEach((cell, index) => {
    cell.addEventListener("click", () => {
        if (cell.textContent === "" && myTurn) {
            cell.textContent = currentPlayerSymbol;
            socket.emit("makeMove", {
                roomId,
                index,
                symbol: currentPlayerSymbol,
            });
            myTurn = false;
            updateTurnNotification(null); // Temporarily disable notification until next move
        }
    });
});

// Receive opponent's move and update board
socket.on("turnUpdate", (data) => {
    const board = data.board;
    document.querySelectorAll(".cell").forEach((cell, index) => {
        cell.textContent = board[index] || ""; // Update board state
    });
    updateTurnNotification(data.currentTurn); // Update whose turn it is
});

// Handle game over (win, lose, tie)
socket.on("gameOver", (data) => {
    document.getElementById("status").textContent = data.result;
    highlightWinningCombination(data.winner); // Optional: highlight winning combination
    disableBoard();
});

// Handle opponent leaving the game
socket.on("playerLeft", (data) => {
    document.getElementById("status").textContent = data.message;
    disableBoard(); // Disable board if opponent leaves
});

// Helper functions
function updateTurnNotification(currentTurn) {
    if (currentTurn === currentPlayerSymbol) {
        document.getElementById("status").textContent = "Your turn!";
        myTurn = true;
        enableBoard();
    } else if (currentTurn) {
        document.getElementById("status").textContent = "Opponent's turn...";
        disableBoard();
    }
}

function enableBoard() {
    document.querySelectorAll(".cell").forEach((cell) => {
        cell.style.pointerEvents = "auto";
    });
}

function disableBoard() {
    document.querySelectorAll(".cell").forEach((cell) => {
        cell.style.pointerEvents = "none";
    });
}

// Optional: Highlight winning cells
function highlightWinningCombination(winner) {
    if (winner) {
        const winningCombination = winner.combination; // Assuming winner object includes winning combination
        winningCombination.forEach((index) => {
            document
                .querySelectorAll(".cell")
                [index].classList.add("highlight");
        });
    }
}

// Validate inputs for room creation/join
function validateInputs(username, roomId, password) {
    if (!username || !roomId || !password) {
        document.getElementById("status").textContent =
            "All fields are required!";
        return false;
    }
    return true;
}
