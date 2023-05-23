"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { Socket, io } from "socket.io-client";

import { useMachine } from "@xstate/react";
import {
  assign,
  createMachine,
  interpret,
  send,
  sendParent,
  sendTo,
  spawn,
} from "xstate";

const attemptToLock = async (context: any, event: any) => {
  console.log(">>", "REQUEST"), context.socket.send("REQUEST");
  context.lockAttempts += 1;
};

const socketMachine = createMachine<{ socket?: Socket }>({
  initial: "disconnected",
  context: {
    socket: undefined,
  },
  states: {
    disconnected: {
      on: {
        CONNECT: "connecting",
      },
    },
    connecting: {
      invoke: {
        src: (context) => (callback) => {
          const socket = io("ws://localhost:1337", {
            transports: ["websocket"],
            reconnection: false,
          });

          const handler = (message: string) => {
            console.log("<<", message)
            if (message === "READY") {
              callback("CONNECTED");
            } else {
              console.error(
                "Received message other than READY on startup. Received",
                message
              );
            }
          };

          context.socket = socket;
          socket.on("message", handler);

          return () => {
            console.log("[SocketMachine:connecting] Cleanup");
            socket.removeListener("message", handler)
          };
        },
      },
      on: {
        CONNECTED: {
          target: "connected",
          actions: sendParent(() => ({
            type: "READY"
          })),
        },
      },
    },
    connected: {
      invoke: {
        src: (context) => (callback) => {
          const handler = (event: string) => {
            console.log("<<", event);
            switch (event) {
              case "READY":
                callback("READY");
                break;
              case "LOCK_ACQUIRED":
                callback("LOCK_ACQUIRED");
                break;
              case "ERROR":
                callback("ERROR")
              default:
                break;
            }
          }

          context.socket?.on("message", handler);

          return () => {
            console.log("[SocketMachine:connected] Cleanup");
            context.socket?.removeListener("message", handler)
          };
        },
      },
      on: {
        REQUEST: {
          actions: attemptToLock,
        },
        LOCK_ACQUIRED: {
          actions: sendParent(() => ({
            type: "LOCK_ACQUIRED"
          }))
        },
        ERROR: {
          actions: sendParent(() => ({
            type: "ERROR"
          }))
        },
        DISCONNECTED: "connecting",
      },
    },
  },
});

const lockMachine = createMachine<{ socketMachine?: any; lockAttempts: number }>({
  id: "lock-machine",
  initial: "connecting",
  context: {
    socketMachine: undefined,
    lockAttempts: 0,
  },
  states: {
    connecting: {
      entry: assign({
        socketMachine: () => spawn(socketMachine, "socket-machine"),
      }),
      on: {
        CONNECT: {
          actions: sendTo("socket-machine", "CONNECT"),
        },
        READY: "ready",
      },
    },
    ready: {
      on: {
        REQUEST: {
          actions: sendTo("socket-machine", "REQUEST"),
          target: "requested",
        },
        LOCK_ACQUIRED: "locked",
      },
    },
    requested: {
      on: {
        LOCK_ACQUIRED: "locked",
        ERROR: "error",
      },
    },
    locked: {
      on: {
        LOCK_RELEASED: "ready",
        RELEASE_LOCK: "ready",
      },
    },
    error: {
      on: {
        RETRY: {
          actions: sendTo("socket-machine", "REQUEST"),
          target: "requested"
        }
      },
    },
  },
});

export default function Home() {
  const [state, send] = useMachine(lockMachine);

  useEffect(() => {
    send("CONNECT");
  }, [send]);

  return (
    <main className={styles.main}>
      <div>LockMachine State: {state.value.toString()}</div>
      <button
        disabled={!state.matches("ready") && !state.matches("error")}
        onClick={() => send(state.matches("error") ? "RETRY" : "REQUEST")}
      >
        {!state.matches("error") ? "REQUEST" : "RETRY"}
      </button>
      <button
        disabled={!state.matches("locked")}
        onClick={() => send("RELEASE_LOCK")}
      >
        UNLOCK
      </button>
    </main>
  );
}
