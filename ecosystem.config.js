module.exports = {
apps: [
  {
    "name": "frontend",
    "script": "yarn",
    "cwd": "./fe",
    "args": "dev",
    "env": {
      "PORT": 3000
    }
  },
  {
    "name": "backend",
    "script": "node",
    "cwd": "./be",
    "args": "index.js",
    "env": {
      "PORT": 3001
    }
  }
]
}
