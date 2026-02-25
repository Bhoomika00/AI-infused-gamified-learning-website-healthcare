import React, { useEffect, useRef, useState } from "react";

export default function SimpleChatbot({ courseSlug }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I can answer questions about mandatory healthcare trainings." }
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  // auto-scroll to the latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, open]);

  async function inferTopic(text) {
    try {
      const r = await fetch("/api/normalize-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text })
      });
      if (!r.ok) return null;
      const data = await r.json(); // { label, score }
      if (!data?.label) return null;
      return { label: data.label, score: data.score };
    } catch {
      return null;
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    const question = input.trim();
    if (!question) return;

    // push user message immediately (with an id so we can attach topic later)
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setMessages((m) => [...m, { id, role: "user", content: question }]);
    setInput("");
    setSending(true);

    // fire topic inference in parallel — update the user message when it returns
    inferTopic(question).then((topic) => {
      if (!topic) return;
      setMessages((m) =>
        m.map((msg) =>
          msg.id === id ? { ...msg, topic } : msg
        )
      );
    });

    try {
      // keep your existing backend call exactly the same
      const response = await fetch("/api/chat/simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: question, courseSlug }) // courseSlug is optional; backend can ignore
      });

      const data = await response.json();
      const answerText = data?.answer || "Sorry, I couldn't process your question.";
      setMessages((m) => [...m, { role: "assistant", content: answerText }]);
    } catch (error) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry, I couldn't process your question." }
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Chat button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-12 h-12 shadow-md flex items-center justify-center"
        aria-label={open ? "Close chat" : "Open chat"}
      >
        💬
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-20 right-5 w-80 h-96 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col">
          {/* Header */}
          <div className="bg-blue-600 text-white p-3 rounded-t-lg flex justify-between items-center">
            <span className="font-medium">Healthcare Training Assistant</span>
            <button
              onClick={() => setOpen(false)}
              className="text-white hover:text-gray-200"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {messages.map((msg, i) => (
              <div
                key={msg.id || i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[80%]">
                  <div
                    className={`rounded-lg px-3 py-2 ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* topic chip under user bubble */}
                  {msg.role === "user" && msg.topic?.label && (
                    <div className="mt-1 text-[11px] text-slate-500">
                      Topic: <span className="font-medium">{msg.topic.label}</span>{" "}
                      {typeof msg.topic.score === "number" &&
                        `(${Math.round(msg.topic.score * 100)}%)`}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 rounded-lg px-3 py-2">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input form */}
          <form onSubmit={sendMessage} className="p-3 border-t">
            <div className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about healthcare training..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:bg-gray-400"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
