import { useState } from "react";
import { Experience } from "./components/Experience";
import { ExplorerRoot } from "./components/explorer/ExplorerRoot";

export default function App() {
  const [showExplorer, setShowExplorer] = useState(false);

  if (showExplorer) {
    return <ExplorerRoot onExit={() => setShowExplorer(false)} />;
  }

  return <Experience onExplore={() => setShowExplorer(true)} />;
}
