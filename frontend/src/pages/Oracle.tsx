import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { useAgents } from '@/hooks/useAgents';
import { useRunPipeline } from '@/hooks/useOrchestrator';
import { ConnectWalletPrompt } from '@/components/common/ConnectWalletPrompt';
import { MessageBubble } from '@/components/MessageBubble';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import type { ChatMessage } from '@/lib/types';

const HEADER = '═══ AEVUM ORACLE ═══';

const SUGGESTED: string[] = [
  'summarize my recent memories',
  'what did i save about 0g last week?',
  'draft a response to my last conversation',
  'find all stored preferences',
];

function newMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

export function Oracle(): JSX.Element {
  const { isConnected, address } = useAccount();
  const agentsQuery = useAgents({ owner: address, pageSize: 50 });
  const runPipeline = useRunPipeline();

  const [agentId, setAgentId] = useState<string>('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logLines, setLogLines] = useState<string[]>([
    '[aevum.oracle] ready.',
    '[aevum.oracle] type a query to begin...',
  ]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const agents = agentsQuery.data?.items ?? [];
  const activeAgent = useMemo(() => agents.find((a) => a.id === agentId) ?? null, [agents, agentId]);

  useEffect(() => {
    if (!agentId && agents.length > 0 && agents[0]) {
      setAgentId(agents[0].id);
    }
  }, [agentId, agents]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, logLines.length]);

  const appendLog = (line: string): void => {
    setLogLines((prev) => {
      const next = [...prev, line];
      return next.slice(-50);
    });
  };

  const handleSend = async (): Promise<void> => {
    const prompt = input.trim();
    if (!prompt || !agentId) return;

    appendLog(`[user] ${prompt}`);
    const userMsg = newMessage('user', prompt);
    const pending = newMessage('agent', '');
    pending.pending = true;
    setMessages((prev) => [...prev, userMsg, pending]);
    setInput('');
    appendLog('[aevum.memory] retrieving 5 relevant memories...');
    appendLog('[aevum.llm] running inference inside TEE...');

    try {
      const res = await runPipeline.mutateAsync({ agentId, prompt, maxMemories: 8 });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pending.id
            ? {
                ...m,
                content: res.response,
                pending: false,
                proof: res.proof,
                memoriesUsed: res.memoriesUsed,
                auditLogId: res.auditLogId,
                timestamp: new Date().toISOString(),
              }
            : m,
        ),
      );
      appendLog(`[aevum.storage] logged: ${res.proof?.hash?.slice(0, 10) ?? '0x------'}...`);
      appendLog(`[aevum.chain] AevumMemory.logMemory() -> ${res.auditLogId?.slice(0, 10) ?? '0x------'}...`);
      if (res.proof) {
        appendLog(`  └─ [TEE:VERIFIED] [${res.proof.hash.slice(0, 10)}...] [${res.inferenceMs}ms]`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'pipeline failed';
      appendLog(`[aevum.error] ${message}`);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pending.id
            ? { ...m, content: 'i could not complete that request.', pending: false, error: message, timestamp: new Date().toISOString() }
            : m,
        ),
      );
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (!isConnected) return <ConnectWalletPrompt />;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] lg:h-[calc(100vh-7rem)]">
      <pre className="term-green text-[10px] sm:text-xs leading-tight whitespace-pre overflow-x-auto mb-3">
{HEADER}
{`[ oracle // chat with an agent ]  [ agent: ${activeAgent?.name ?? 'none'} ]`}
[ tee: enabled ]  [ mem_retrieval: top-8 ]  [ proof: signed ]
{'─'.repeat(64)}
      </pre>

      <div className="flex items-center gap-2 mb-3 text-xs flex-wrap">
        <span className="term-green">[SELECT AGENT:</span>
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="term-input py-1 text-xs flex-1 min-w-[200px]"
          disabled={agentsQuery.isLoading}
        >
          {agents.length === 0 && <option value="">no agents available</option>}
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              #{a.id.slice(0, 6)} - {a.name} - {a.role}
            </option>
          ))}
        </select>
        <span className="term-green">{'\u25BE'}]</span>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3">
        <div className="term-panel flex flex-col min-h-0">
          <div className="px-3 py-1.5 border-b border-terminal-border text-[10px] term-muted">
            <span className="term-green">┌─[</span> chat_session <span className="term-green">]</span>
          </div>
          <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center px-4">
                <p className="text-sm term-muted">
                  {'>'} {activeAgent ? `hello, i am ${activeAgent.name}` : 'select an agent to begin'}
                </p>
                <p className="mt-2 text-xs term-dim">
                  ask anything - i'll search your memory, generate a response, and sign it inside a tee.
                </p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                  {SUGGESTED.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setInput(p)}
                      className="text-left text-[11px] term-text border border-terminal-border p-2 hover:border-terminal-green hover:term-green transition-colors"
                    >
                      {'>'} {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
          <div className="border-t border-terminal-border p-2">
            <div className="flex items-end gap-2">
              <span className="text-xs term-green pt-2">aevum {'>'}</span>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
                placeholder={activeAgent ? `query ${activeAgent.name}...` : 'select an agent first...'}
                disabled={!activeAgent || runPipeline.isPending}
                className="term-input resize-none min-h-[40px] max-h-32 py-1.5 text-sm flex-1"
                aria-label="Message"
              />
              <span className="text-xs term-green pt-2 cursor-blink">_</span>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!input.trim() || !activeAgent || runPipeline.isPending}
                className="term-btn-primary text-xs"
                aria-label="Send message"
              >
                {runPipeline.isPending ? <LoadingSpinner /> : '[SEND]'}
              </button>
            </div>
            <p className="mt-1 text-[10px] term-dim">
              [enter] send &nbsp;|&nbsp; [shift+enter] newline
            </p>
          </div>
        </div>

        <aside className="hidden lg:flex flex-col min-h-0">
          <div className="term-panel flex-1 min-h-0 flex flex-col">
            <div className="px-3 py-1.5 border-b border-terminal-border text-[10px] term-muted">
              <span className="term-cyan">┌─[</span> session_log <span className="term-cyan">]</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 text-[11px] space-y-0.5">
              {logLines.map((line, i) => (
                <div key={i} className="leading-relaxed break-words">
                  {colorizeLogLine(line)}
                </div>
              ))}
              <div className="text-[10px] term-dim mt-2">
                <span className="term-green cursor-blink">_</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function colorizeLogLine(line: string): JSX.Element {
  if (line.startsWith('[user]')) {
    return <><span className="term-magenta">[user]</span><span className="term-text"> {line.slice(6)}</span></>;
  }
  if (line.startsWith('[aevum.llm]')) {
    return <><span className="term-green">[aevum.llm]</span><span className="term-text"> {line.slice(11)}</span></>;
  }
  if (line.startsWith('[aevum.memory]')) {
    return <><span className="term-cyan">[aevum.memory]</span><span className="term-muted"> {line.slice(14)}</span></>;
  }
  if (line.startsWith('[aevum.storage]')) {
    return <><span className="term-amber">[aevum.storage]</span><span className="term-text"> {line.slice(15)}</span></>;
  }
  if (line.startsWith('[aevum.chain]')) {
    return <><span className="term-amber">[aevum.chain]</span><span className="term-text"> {line.slice(13)}</span></>;
  }
  if (line.startsWith('[aevum.error]')) {
    return <><span className="term-red">[aevum.error]</span><span className="term-red"> {line.slice(13)}</span></>;
  }
  if (line.startsWith('[aevum.oracle]')) {
    return <><span className="term-green">[aevum.oracle]</span><span className="term-muted"> {line.slice(14)}</span></>;
  }
  if (line.startsWith('  └─')) {
    return <span className="term-dim">{line}</span>;
  }
  return <span className="term-text">{line}</span>;
}
