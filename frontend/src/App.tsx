import { useEffect, useRef, useState } from "react";
import {
  parse,
  compile_program,
  run,
  Instruction,
  Heap,
  Machine,
} from "go-slang";
import { Editor, OnChange, OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

import { Tab, Tabs } from "./Tabs";
import { getErrorDescription, getHeapJSValueString } from "./utils";

import "./App.css";

type Editor = monaco.editor.IStandaloneCodeEditor;

type EditorState =
  | {
      state: "empty";
    }
  | {
      state: "parse-error";
      error: string;
    }
  | {
      state: "compile-error";
      ast: unknown;
      error: string;
    }
  | {
      state: "compiled";
      ast: unknown;
      instructions: Instruction[];
    }
  | {
      state: "finished";
      ast: unknown;
      instructions: Instruction[];
      machines: Machine[];
      heap: Heap;
    };

function App() {
  const editorRef = useRef<Editor>();
  const [editorState, setEditorState] = useState<EditorState>({
    state: "empty",
  });

  const handleEditorDidMount: OnMount = (editor) => {
    try {
      const previousProgram = window.localStorage.getItem("program") ?? "";
      if (previousProgram) {
        editor.setValue(previousProgram);
      }
    } catch (e) {
      // no-op
    }
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () =>
      compileProgram(),
    );
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
      compileProgram(true),
    );
    editorRef.current = editor;
  };
  const handleEditorDidChange: OnChange = (value) => {
    window.localStorage.setItem("program", value ?? "");
  };

  function compileProgram(runProgram: boolean = false) {
    const programText = editorRef.current!.getValue();
    try {
      const ast = parse(programText, {});
      try {
        const instructions = compile_program(ast);
        if (runProgram) {
          const { heap, machines } = run(instructions, { heap_size: 50000 });
          setEditorState({
            state: "finished",
            ast,
            instructions,
            heap,
            machines,
          });
        } else {
          setEditorState({
            state: "compiled",
            ast,
            instructions,
          });
        }
      } catch (err) {
        setEditorState({
          state: "compile-error",
          ast,
          error: getErrorDescription(err),
        });
      }
    } catch (err) {
      setEditorState({
        state: "parse-error",
        error: getErrorDescription(err),
      });
    }
  }

  return (
    <div className="grid">
      <div className="row-1 column-1 header">
        <h1>go-slang</h1>
        <button onClick={() => compileProgram(true)}>Run</button>
        <button onClick={() => compileProgram()}>Compile</button>
      </div>
      <div className="column-1">
        <Editor
          language="go"
          defaultValue="a := 1"
          options={{ minimap: { enabled: false } }}
          onMount={handleEditorDidMount}
          onChange={handleEditorDidChange}
        />
      </div>

      <InstructionsPanel editorState={editorState} />

      <MachinesPanel editorState={editorState} />
    </div>
  );
}

type InstructionsTab = "instructions" | "ast";

function InstructionsPanel({ editorState }: { editorState: EditorState }) {
  const [tab, setTab] = useState<InstructionsTab>("instructions");

  useEffect(() => {
    switch (editorState.state) {
      case "empty":
      case "compile-error":
        setTab("instructions");
        return;
      case "parse-error":
        setTab("ast");
        return;
      case "compiled":
      case "finished":
        // Persist tab since both tabs are available
        return;
    }
  }, [editorState.state]);

  return (
    <>
      <div className="row-1 column-2">
        <Tabs<InstructionsTab> tab={tab} setTab={setTab}>
          {(() => {
            switch (editorState.state) {
              case "empty":
                return <Tab name="instructions">Instructions</Tab>;
              case "parse-error":
                return <Tab name="ast">Parse error</Tab>;
              case "compile-error":
                return (
                  <>
                    <Tab name="instructions">Compile error</Tab>
                    <Tab name="ast">AST</Tab>
                  </>
                );
              case "compiled":
              case "finished":
                return (
                  <>
                    <Tab name="instructions">Instructions</Tab>
                    <Tab name="ast">AST</Tab>
                  </>
                );
            }
          })()}
        </Tabs>
      </div>

      <div className="column-2">
        {tab === "instructions" &&
          (() => {
            switch (editorState.state) {
              case "empty":
              case "parse-error":
                return;
              case "compile-error":
                return (
                  <Editor
                    value={editorState.error}
                    options={{ minimap: { enabled: false }, readOnly: true }}
                  />
                );
              case "compiled":
              case "finished":
                return (
                  <Editor
                    value={editorState.instructions
                      .map((output) => JSON.stringify(output))
                      .join("\n")}
                    options={{
                      minimap: { enabled: false },
                      readOnly: true,
                      lineNumbers: (number) => `${number - 1}`,
                    }}
                  />
                );
            }
          })()}
        {tab === "ast" &&
          (() => {
            switch (editorState.state) {
              case "empty":
                return;
              case "parse-error":
                return (
                  <Editor
                    value={editorState.error}
                    options={{ minimap: { enabled: false }, readOnly: true }}
                  />
                );
              case "compile-error":
              case "compiled":
              case "finished":
                return (
                  <Editor
                    value={JSON.stringify(editorState.ast, null, 2)}
                    options={{ minimap: { enabled: false }, readOnly: true }}
                  />
                );
            }
          })()}
      </div>
    </>
  );
}

function MachinesPanel({ editorState }: { editorState: EditorState }) {
  const [machineIndex, setMachineIndex] = useState(0);
  const machine =
    editorState.state === "finished"
      ? editorState.machines[machineIndex]
      : undefined;

  useEffect(() => {
    setMachineIndex(0);
  }, [editorState.state]);

  return (
    <>
      <div className="row-1 column-3">
        <Tabs tab={machineIndex} setTab={setMachineIndex}>
          {(() => {
            switch (editorState.state) {
              case "empty":
              case "parse-error":
              case "compile-error":
              case "compiled":
                return <Tab name={0}>Default Machine</Tab>;
              case "finished":
                return editorState.machines.map((_, i) => (
                  <Tab name={i}>
                    {i === 0 ? "Default Machine" : `Machine ${i}`}
                  </Tab>
                ));
            }
          })()}
        </Tabs>
      </div>

      <div className="column-3">
        {machine && (
          <>
            <p>
              <strong>State:</strong> <code>{machine.state.state} </code>
            </p>
            {machine.state.state === "errored" && (
              <p>
                <strong>Error:</strong>{" "}
                <pre>
                  <code>{getErrorDescription(machine.state.error)}</code>
                </pre>
              </p>
            )}
            {editorState.state === "finished" &&
              machine.state.state === "finished" && (
                <p>
                  <strong>Final value:</strong>{" "}
                  <code>
                    {getHeapJSValueString(
                      editorState.heap,
                      machine.OS[machine.OS.length - 1],
                    )}
                  </code>
                </p>
              )}
            {machine.output.length > 0 && (
              <>
                <p>
                  <strong>Logged output</strong>
                </p>
                <pre>
                  <code>
                    {machine.output
                      .map((output) => JSON.stringify(output))
                      .join("\n")}
                  </code>
                </pre>
              </>
            )}
            {editorState.state === "finished" &&
              machine.state.state === "finished" && (
                <>
                  <p>
                    <strong>Operand stack:</strong>{" "}
                  </p>
                  <pre>
                    <code>
                      {machine.OS.map((address) =>
                        getHeapJSValueString(editorState.heap, address),
                      )
                        .reverse()
                        .join("\n")}
                    </code>
                  </pre>
                </>
              )}
          </>
        )}
      </div>
    </>
  );
}

export default App;
