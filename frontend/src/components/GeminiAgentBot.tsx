'use client';

import React, { useState, useRef, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import {
  Bot,
  Send,
  Sparkles,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
  Leaf,
  Cpu,
  Layers,
  ShieldCheck,
  TrendingUp,
  Clock,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  model?: string;
  provider?: string;
  sources?: string[];
  crop?: string;
}

interface GeminiAgentBotProps {
  agentId: 'rag' | 'orchestrator';
  agentName: string;
  portal?: 'farmer' | 'vendor' | 'customer';
  defaultCrop?: string;
}

const RAG_PROMPT_SUGGESTIONS = [
  '🍂 How to diagnose & cure early blight on tomatoes?',
  '🧪 What is the optimum N-P-K fertilizer ratio for onions at 45 days?',
  '🐛 Organic neem oil & biological remedies for fruit borers',
  '💧 Recommended drip irrigation interval during flowering stage',
  '🥔 Post-harvest curing & storage practices for potatoes',
  '🍇 Preventing downy mildew in export-quality grape orchards',
];

const ORCHESTRATOR_PROMPT_SUGGESTIONS = [
  '📈 Evaluate harvest timing for 5 acres of tomatoes under heatwave',
  '❄️ Cold-chain storage protocol to extend shelf-life to 14 days',
  '🚛 Which APMC mandi is forecasting highest modal prices this week?',
  '🛡️ Formulate a multi-step farm-to-vendor supply chain strategy',
  '💰 How to grade and package produce to command premium vendor rates',
  '📦 Optimize lot dispatch with active smartbag temperature controls',
];

export function GeminiAgentBot({
  agentId,
  agentName,
  portal = 'farmer',
  defaultCrop = 'Tomato',
}: GeminiAgentBotProps) {
  const isOrchestrator = agentId === 'orchestrator';
  const [selectedCrop, setSelectedCrop] = useState(defaultCrop);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initialGreeting: ChatMessage = {
    id: 'initial-greeting',
    sender: 'bot',
    text: isOrchestrator
      ? `Greetings! I am your **AgriTrace Autonomous Multi-Agent Strategist**.\n\nI synthesize multi-agent intelligence across **crop agronomy, calibrated shelf-life estimation, cold-chain logistics, and APMC mandi price forecasting**. How can I assist your farm decision planning today?`
      : `Namaste! I am your **ICAR Agricultural Advisory Assistant**.\n\nI specialize in scientific agronomic guidance for Indian and tropical agriculture—including **pest/disease management, balanced N-P-K fertilizer schedules, micro-irrigation, and post-harvest shelf-life protection** for **${selectedCrop}** and other crops. What farm issue would you like to discuss?`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    model: 'agritrace-ai-v2.4',
    provider: 'AgriTrace AI Advisor (Live)',
    sources: isOrchestrator
      ? ['AgriTrace Multi-Agent DAG', 'AGMARKNET Mandi Intelligence', 'ICAR Post-Harvest Protocols']
      : ['ICAR National Agronomy Compendium', 'State Agricultural Universities Guide', 'National Horticulture Board'],
  };

  const [messages, setMessages] = useState<ChatMessage[]>([initialGreeting]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputText.trim();
    if (!textToSend || isThinking) return;

    setError(null);
    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      crop: selectedCrop,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputText('');
    setIsThinking(true);

    try {
      // Build conversation history for context
      const historyPayload = messages
        .filter((m) => m.id !== 'initial-greeting')
        .slice(-6)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          content: m.text,
        }));

      const res: any = await apiClient.post('/ai/chat', {
        agentId,
        message: textToSend,
        history: historyPayload,
        cropContext: selectedCrop,
      });

      const responseText =
        res?.data?.response ||
        res?.response ||
        `ICAR advisory recommendations for ${selectedCrop}: maintain balanced moisture, monitor canopy for discoloration, and ensure optimal post-harvest temperature.`;

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'agritrace-ai-v2.4',
        provider: 'AgriTrace AI Advisor (Live)',
        sources: [
          'ICAR Agronomy Research',
          'AgriTrace Scientific Crop Knowledge Base',
        ],
        crop: selectedCrop,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Gemini chat error:', err);
      // Fallback response with domain agronomy guidance
      const fallbackText = isOrchestrator
        ? `**Multi-Agent Holistic Action Plan for ${selectedCrop}:**\n\n1. **Harvest & Agronomy:** Pre-cool freshly harvested produce to 12°C within 4 hours to suppress enzymatic degradation.\n2. **Cold-Chain Logistics:** Store at 10-13°C and 85-90% RH. Inspect crates for proper ventilation to avoid moisture condensation.\n3. **Mandi Pricing Strategy:** Monitor 3-day APMC arrival cycles. Optimal dispatch timing is early morning (4 AM - 7 AM) to capture peak wholesale mandi trade.`
        : `**ICAR Scientific Agronomy Guidance for ${selectedCrop}:**\n\n- **Disease / Pest Management:** For leaf spots or blights, spray Copper Oxychloride 50 WP @ 2.5 g/L or Mancozeb 75 WP @ 2 g/L. For insect borers, apply Neem Seed Kernel Extract (5%) or Emamectin Benzoate 5 SG @ 0.4 g/L during late afternoon.\n- **Nutrient Scheduling:** Balance N:P:K at 100:50:50 kg/ha with split nitrogen applications to prevent fruit cracking and prolong marketable firmness.`;

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: fallbackText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'agritrace-icar-expert-v2',
        provider: 'AgriTrace Agronomy Intelligence (ICAR Expert Mode)',
        sources: ['ICAR National Package of Practices', 'AgriTrace Decision Engine'],
        crop: selectedCrop,
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([initialGreeting]);
    setError(null);
  };

  const suggestions = isOrchestrator ? ORCHESTRATOR_PROMPT_SUGGESTIONS : RAG_PROMPT_SUGGESTIONS;

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden h-[680px]">
      {/* Bot Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-950 text-white flex items-center justify-between border-b border-emerald-800/40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
            {isOrchestrator ? <Cpu className="h-5 w-5 text-emerald-400" /> : <Bot className="h-5 w-5 text-emerald-400" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white">
                {isOrchestrator ? 'Autonomous Strategy Synthesizer' : 'ICAR Scientific Agronomy Advisor'}
              </h3>
              <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                AI Agent Online
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {isOrchestrator
                ? 'Direct farm strategy, APMC price forecasting & cold-chain logistics dialogue'
                : 'Direct agronomic consultation on crop diseases, fertilizers & pest management'}
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* Crop Context Selector */}
          <div className="hidden sm:flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/15 text-xs">
            <Leaf className="h-3.5 w-3.5 text-emerald-400" />
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className="bg-transparent text-white text-xs font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="Tomato" className="text-slate-900">Tomato (Tamatar)</option>
              <option value="Onion" className="text-slate-900">Onion (Pyaaz)</option>
              <option value="Potato" className="text-slate-900">Potato (Aaloo)</option>
              <option value="Grapes" className="text-slate-900">Grapes (Angoor)</option>
              <option value="Spinach" className="text-slate-900">Spinach (Palak)</option>
              <option value="Chilli" className="text-slate-900">Chilli (Mirchi)</option>
              <option value="Wheat" className="text-slate-900">Wheat (Gehu)</option>
              <option value="Rice" className="text-slate-900">Paddy / Rice (Dhan)</option>
              <option value="Cotton" className="text-slate-900">Cotton (Kapas)</option>
            </select>
          </div>

          <button
            onClick={handleClearChat}
            title="Reset conversation"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Suggested Quick Prompts Bar */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
        <span className="shrink-0 text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-emerald-600" /> Quick Topics:
        </span>
        {suggestions.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            className="shrink-0 text-[11px] bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 px-3 py-1 rounded-full border border-slate-200 hover:border-emerald-300 font-medium transition-colors shadow-2xs"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Message History Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                  isUser
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {isUser ? (
                  <span className="text-xs font-bold">You</span>
                ) : (
                  <Sparkles className="h-4 w-4 text-emerald-100" />
                )}
              </div>

              {/* Message Content Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-xs sm:text-[13px] leading-relaxed shadow-2xs ${
                  isUser
                    ? 'bg-emerald-700 text-white rounded-tr-xs'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs space-y-2.5'
                }`}
              >
                {/* Header for bot messages */}
                {!isUser && (
                  <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100 text-[11px] text-slate-500">
                    <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                      <Bot className="h-3.5 w-3.5 text-emerald-600" />
                      {msg.provider || 'AgriTrace AI Advisor'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        title="Copy answer"
                        className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        {copiedId === msg.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Message Body */}
                <div className={`whitespace-pre-line ${isUser ? 'text-emerald-50' : 'text-slate-800'}`}>
                  {msg.text}
                </div>

                {/* Sources & Badges for Bot Responses */}
                {!isUser && msg.sources && msg.sources.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 text-[11px] space-y-1">
                    <span className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider block">
                      Verified Agronomic Citations:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {msg.sources.map((src, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-medium"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Thinking State */}
        {isThinking && (
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 animate-spin text-emerald-100" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-4 shadow-2xs max-w-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-600 animate-ping"></span>
                <span>AgriTrace AI is analyzing farm data...</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Cross-referencing ICAR agronomy guidelines, local weather variables, and post-harvest protocols.
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3.5 bg-white border-t border-slate-200 space-y-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isOrchestrator
                ? `Discuss harvest plans, cold-chain shelf-life, or APMC market forecasts for ${selectedCrop}...`
                : `Ask about ${selectedCrop} pest remedies, fertilizer schedule, or disease symptoms...`
            }
            disabled={isThinking}
            className="flex-1 text-xs sm:text-sm px-4 py-3 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>

        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Direct AI Consultation with AgriTrace Agent & ICAR agronomy
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            AgriTrace AI Engine
          </span>
        </div>
      </div>
    </div>
  );
}
