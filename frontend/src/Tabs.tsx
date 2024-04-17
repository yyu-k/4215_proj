import { ReactNode, createContext, useContext, useMemo } from "react";

type TabsContextValue<T> = {
  tab: T;
  setTab: (tab: T) => void;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TabsContext = createContext<TabsContextValue<any>>({
  tab: "",
  setTab: () => {},
});

export function Tabs<T>({
  tab,
  setTab,
  children,
}: {
  tab: T;
  setTab: (tab: T) => void;
  children?: ReactNode;
}) {
  return (
    <TabsContext.Provider
      value={useMemo(() => ({ tab, setTab }), [tab, setTab])}
    >
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

export function Tab<T>({ name, children }: { name: T; children?: ReactNode }) {
  const { tab, setTab } = useContext<TabsContextValue<T>>(TabsContext);

  return (
    <button
      className={"tab" + (name === tab ? " active" : "")}
      onClick={() => setTab(name)}
    >
      {children}
    </button>
  );
}
