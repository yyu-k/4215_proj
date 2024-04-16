# Frontend

This directory contains the frontend to `go-slang`.

## Setup

Firstly, `go-slang` needs to be compiled first.

```sh
cd go-slang
npm install
npm run build
```

Then, install the dependencies for the frontend before linking the compiled `go-slang` package.

```sh
cd frontend
npm install
npm link ../go-slang
```

## Development

To start the development server, run:

```sh
npm run dev
```

To build the project, run:

```sh
npm run build
npm run preview # to start a server for the built project
```
