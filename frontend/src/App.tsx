import { useState } from "react";
import "./App.css";
import { parse, compile_program, run } from "go-slang";

function App() {
  const [programText, setProgramText] = useState<string>("");
  const [results, setResults] = useState<ReturnType<typeof run>>([]);

  function runProgram() {
    const ast = parse(programText, {});
    const instructions = compile_program(ast);
    setResults(run(instructions, 50000));
  }

  return (
    <>
      <h1>go-slang</h1>
      {/* TODO: Install code editor */}
      <textarea
        id="input"
        placeholder="Enter your Go code here"
        onChange={(e) => setProgramText(e.target.value)}
      />
      <button onClick={runProgram}>Run</button>

      {results.map((machine, i) => (
        <section key={i}>
          <h2>Machine {i + 1}</h2>
          <h3>Machine state</h3>
          <p>{machine.state.state}</p>
          <h3>Output</h3>
          {machine.output.length > 0 ? (
            <pre>
              <code>
                {machine.output
                  .map((output) => JSON.stringify(output))
                  .join("\n")}
              </code>
            </pre>
          ) : (
            <p>None</p>
          )}
          <h3>Final value</h3>
          <pre>
            <code>{JSON.stringify(machine.final_value)}</code>
          </pre>
        </section>
      ))}
    </>
  );
}

export default App;
