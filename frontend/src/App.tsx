import { useRef, useState } from "react";
import { parse, compile_program, run } from "go-slang";
import { Editor, OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

import "./App.css";

type Editor = monaco.editor.IStandaloneCodeEditor;
// TODO: expose from `go-slang`
type Instructions = ReturnType<typeof compile_program>;
type Machines = ReturnType<typeof run>;

type EditorState =
  | {
      state: "empty";
    }
  | {
      state: "compile-error";
      error: string;
      oldInstructions: Instructions;
      oldMachines: Machines;
    }
  | {
      state: "compiled";
      instructions: Instructions;
      oldMachines: Machines;
    }
  | {
      state: "finished";
      instructions: Instructions;
      machines: Machines;
    };

function App() {
  const editorRef = useRef<Editor>();
  const [editorState, setEditorState] = useState<EditorState>({
    state: "empty",
  });

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  function compileProgram() {
    try {
      const programText = editorRef.current!.getValue();
      const ast = parse(programText, {});
      const instructions = compile_program(ast);
      setEditorState({
        state: "compiled",
        instructions,
        oldMachines:
          editorState.state === "finished" ? editorState.machines : [],
      });
    } catch (err) {
      setEditorState({
        state: "compile-error",
        error:
          (err as { message: string }).message +
          (typeof (err as { stack: string }).stack === "string"
            ? "\n\n" + (err as { stack: string }).stack
            : ""),
        oldInstructions:
          editorState.state === "compiled" || editorState.state === "finished"
            ? editorState.instructions
            : [],
        oldMachines:
          editorState.state === "finished" ? editorState.machines : [],
      });
    }
  }

  function runProgram() {
    try {
      const programText = editorRef.current!.getValue();
      const ast = parse(programText, {});
      const instructions = compile_program(ast);
      const results = run(instructions, 50000);
      setEditorState({
        state: "finished",
        instructions,
        machines: results,
      });
    } catch (err) {
      setEditorState({
        state: "compile-error",
        error:
          (err as { message: string }).message +
          (typeof (err as { stack: string }).stack === "string"
            ? "\n\n" + (err as { stack: string }).stack
            : ""),
        oldInstructions:
          editorState.state === "compiled" || editorState.state === "finished"
            ? editorState.instructions
            : [],
        oldMachines:
          editorState.state === "finished" ? editorState.machines : [],
      });
    }
  }

  return (
    <div className="grid">
      <div>
        <div>
          <button onClick={runProgram}>Run</button>
          <button onClick={compileProgram}>Compile</button>
        </div>
        <Editor
          height="90vh"
          defaultLanguage="go"
          defaultValue="a := 1"
          onMount={handleEditorDidMount}
        />
      </div>

      <div>
        {editorState.state === "compile-error" && (
          <div>
            <h2>Compile error</h2>
            <pre>
              <code>{editorState.error}</code>
            </pre>
          </div>
        )}
        {(editorState.state === "compiled" ||
          editorState.state === "finished") && (
          <div>
            <h2>Instructions</h2>
            <pre>
              <code>
                {editorState.instructions
                  .map((output) => JSON.stringify(output))
                  .join("\n")}
              </code>
            </pre>
          </div>
        )}
      </div>

      <div>
        {editorState.state === "finished" &&
          editorState.machines.map((machine, i) => (
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
      </div>
    </div>
  );
}

export default App;
