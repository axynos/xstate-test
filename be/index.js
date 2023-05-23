const { Server } = require("socket.io");

const io = new Server();

io.on("connection", (socket) => {
  setTimeout(() => {
    socket.send("READY")
  }, process.env.PORT ?? 3001)
  
  socket.on("message", (event) => {
    switch (event) {
      case "REQUEST":
        setTimeout(() => {
          console.log(">>", "LOCK_ACQUIRED")
          const simulateError = Math.random() > 0.5

          socket.send(simulateError ? "ERROR" : "LOCK_ACQUIRED");
        }, 2000);
        break;
      default:
        break;
    }
  });
});

io.listen(1337);
