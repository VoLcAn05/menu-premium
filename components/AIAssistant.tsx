"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "¡Hola! Soy tu asistente de Fogón Barinés. Puedo ayudarte a elegir qué comer, describir ingredientes y recomendar complementos. ¿Qué te gustaría saber?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-gold shadow-lg hover:bg-gold-light transition-colors flex items-center justify-center"
      >
        <span className="text-2xl">🤖</span>
      </button>

      {/* Modal del chat */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 h-96 rounded-2xl shadow-2xl bg-charcoal border border-gold/30 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gold/10 border-b border-gold/20 px-4 py-3 flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold text-cream">
                Asistente IA
              </h3>
              <p className="text-xs text-cream/60">
                Recomendaciones del menú
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-cream/60 hover:text-cream"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg ${
                    msg.role === "user"
                      ? "bg-gold text-ink rounded-br-none"
                      : "bg-cream/10 text-cream rounded-bl-none"
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-cream/10 text-cream px-3 py-2 rounded-lg rounded-bl-none">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-cream/60 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-cream/60 rounded-full animate-pulse delay-100"></div>
                    <div className="w-2 h-2 bg-cream/60 rounded-full animate-pulse delay-200"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gold/20 p-3 bg-charcoal/80">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleSendMessage();
                }}
                placeholder="Pregunta algo..."
                className="flex-1 bg-cream/10 border border-gold/20 rounded-lg px-3 py-2 text-sm text-cream placeholder-cream/40 focus:outline-none focus:border-gold/50"
              />
              <button
                onClick={handleSendMessage}
                disabled={loading}
                className="bg-gold text-ink px-3 py-2 rounded-lg hover:bg-gold-light disabled:opacity-50"
              >
                →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
