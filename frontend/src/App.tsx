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
import { handle_blocked_machines } from "go-slang/dist/scheduler";

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
      state: "stepping";
      ast: unknown;
      instructions: Instruction[];
      machines: Machine[];
      heap: Heap;
      activeMachineIndex: number;
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

  function compileProgram(runProgram: boolean = false): EditorState {
    const programText = editorRef.current!.getValue();
    try {
      const ast = parse(programText, {});
      try {
        const instructions = compile_program(ast);
        if (runProgram) {
          const { heap, machines } = run(instructions, { heap_size: 50000 });
          return {
            state: "finished",
            ast,
            instructions,
            heap,
            machines,
          };
        } else {
          return {
            state: "compiled",
            ast,
            instructions,
          };
        }
      } catch (err) {
        return {
          state: "compile-error",
          ast,
          error: getErrorDescription(err),
        };
      }
    } catch (err) {
      return {
        state: "parse-error",
        error: getErrorDescription(err),
      };
    }
  }

  function stepProgram(all: boolean = false): EditorState {
    let ast: unknown;
    let heap: Heap;
    let instructions: Instruction[];
    let machines: Machine[];
    let activeMachineIndex: number;
    if (editorState.state !== "stepping") {
      const newState = compileProgram();
      if (newState.state !== "compiled") {
        return newState;
      }
      ({ instructions, ast } = newState);
      heap = new Heap();
      machines = [new Machine(instructions, heap)];
      activeMachineIndex = 0;
    } else {
      ({ instructions, ast, heap, machines, activeMachineIndex } = editorState);
    }

    const activeMachine = machines[activeMachineIndex];
    do {
      const result = activeMachine.run(1);
      if (result.new_machines.length > 0) {
        machines = machines.concat(result.new_machines);
      }
      handle_blocked_machines(heap, machines);
    } while (all && activeMachine.state.state === "default");

    return {
      state: "stepping",
      ast,
      instructions,
      heap,
      machines,
      activeMachineIndex,
    };
  }

  return (
    <div className="grid">
      <div className="row-1 column-1 header">
        <h1>go-slang</h1>
        <button onClick={() => setEditorState(compileProgram(true))}>
          Run
        </button>
        <button onClick={() => setEditorState(compileProgram())}>
          Compile
        </button>
        <button onClick={() => setEditorState(stepProgram())}>Step</button>
        <button onClick={() => setEditorState(stepProgram(true))}>
          Step All
        </button>
      </div>
      <div className="column-1">
        <Editor
          language="go"
          defaultValue="a := 1"
          options={{
            minimap: { enabled: false },
            readOnly: editorState.state === "stepping",
          }}
          onMount={handleEditorDidMount}
          onChange={handleEditorDidChange}
        />
      </div>

      <InstructionsPanel editorState={editorState} />

      <MachinesPanel
        editorState={editorState}
        setEditorState={setEditorState}
      />
    </div>
  );
}

type InstructionsTab = "instructions" | "ast";

function InstructionsPanel({ editorState }: { editorState: EditorState }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [tab, setTab] = useState<InstructionsTab>("instructions");

  const handleEditorDidMount: OnMount = (editor) => {
    setEditor(editor);
  };

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
      case "stepping":
      case "finished":
        // Persist tab since both tabs are available
        return;
    }
  }, [editorState.state]);

  const highlightedLine =
    editorState.state === "stepping"
      ? editorState.machines[editorState.activeMachineIndex].PC + 1
      : undefined;

  useEffect(() => {
    if (!editor) return;
    if (highlightedLine) {
      const decorations = editor.createDecorationsCollection([
        {
          range: new monaco.Range(highlightedLine, 1, highlightedLine, 1),
          options: {
            isWholeLine: true,
            linesDecorationsClassName: "active-line",
          },
        },
      ]);
      editor.revealLineInCenter(highlightedLine);

      return () => decorations.clear();
    }
  }, [highlightedLine, editor]);

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
              case "stepping":
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
              case "stepping":
              case "finished":
                return (
                  <Editor
                    onMount={handleEditorDidMount}
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
              case "stepping":
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

function MachinesPanel({
  editorState,
  setEditorState,
}: {
  editorState: EditorState;
  setEditorState: (editorState: EditorState) => void;
}) {
  const [internalMachineIndex, setInternalMachineIndex] = useState(0);
  const machineIndex =
    editorState.state === "stepping"
      ? editorState.activeMachineIndex
      : internalMachineIndex;
  const setMachineIndex =
    editorState.state === "stepping"
      ? (index: number) => {
          setEditorState({ ...editorState, activeMachineIndex: index });
        }
      : setInternalMachineIndex;
  const machine =
    editorState.state === "stepping" || editorState.state === "finished"
      ? editorState.machines[machineIndex]
      : undefined;

  useEffect(() => {
    setMachineIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              case "stepping":
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
            {(editorState.state === "stepping" ||
              editorState.state === "finished") &&
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
            {editorState.state === "stepping" &&
              machine.state.state !== "finished" && (
                <div className="stacks">
                  <div>
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
                  </div>
                  <div>
                    <p>
                      <strong>Runtime stack:</strong>{" "}
                    </p>
                    <pre>
                      <code>
                        {machine.RTS.map((address) =>
                          getHeapJSValueString(editorState.heap, address),
                        )
                          .reverse()
                          .join("\n")}
                      </code>
                    </pre>
                  </div>
                </div>
              )}
          </>
        )}
      </div>
    </>
  );
}

export default App;
