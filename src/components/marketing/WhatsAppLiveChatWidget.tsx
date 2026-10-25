import React, { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  id: string;
  sender: 'agent' | 'user';
  text: string;
  timestamp: string;
}

const WHATSAPP_NUMBER = '8801797252627';
const FORMATTED_PHONE = '+880 1797-252627';

const QUICK_TOPICS = [
  {
    id: 'quote',
    type: 'quote',
    label: 'Get a Shipping Quote',
    msg: 'Hello Go Shipping! I would like to get a shipping quote for importing products from China to Bangladesh.'
  },
  {
    id: 'track',
    type: 'track',
    label: 'Track Consignment',
    msg: 'Hello Go Shipping! I need to check the live tracking status of my consignment. Tracking ID: '
  },
  {
    id: 'air',
    type: 'air',
    label: 'Fast Air Freight (7-14 Days)',
    msg: 'Hello Go Shipping! What are your current Air Freight rates and departure schedules from Guangzhou to Dhaka?'
  },
  {
    id: 'sea',
    type: 'sea',
    label: 'Sea Cargo / Container (FCL/LCL)',
    msg: 'Hello Go Shipping! I have bulk cargo and want to know your Sea Freight CBM rates to Chittagong / Dhaka.'
  },
  {
    id: 'warehouse',
    type: 'warehouse',
    label: 'China Warehouse Address',
    msg: 'Hello Go Shipping! Please share your Guangzhou and Yiwu warehouse addresses with my unique marking code.'
  }
];

export default function WhatsAppLiveChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(1);
  const [isTyping, setIsTyping] = useState(false);
  const [showNotificationBadge, setShowNotificationBadge] = useState(true);

  // Initial conversation messages
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome-1',
      sender: 'agent',
      text: 'Welcome to Go Shipping Bangladesh.',
      timestamp: 'Just now'
    },
    {
      id: 'msg-welcome-2',
      sender: 'agent',
      text: 'How can we help your business today? Choose a quick inquiry topic below or send your query directly to our 24/7 WhatsApp dispatch team!',
      timestamp: 'Just now'
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isTyping]);

  // Load saved chat history from localStorage if any
  useEffect(() => {
    try {
      const saved = localStorage.getItem('goshipping_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          setUnreadCount(0);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleChat = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      setUnreadCount(0);
      setShowNotificationBadge(false);

      // Track engagement event
      if (typeof window !== 'undefined' && (window as any).goShippingTrack) {
        (window as any).goShippingTrack('Engagement', {
          action: 'whatsapp_widget_opened',
          time: new Date().toISOString()
        });
      }
    }
  };

  // Dispatch message to WhatsApp Web / App
  const sendToWhatsApp = (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed) return;

    // Append to local message thread
    const newMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updated = [...messages, newMsg];
    setMessages(updated);
    setInputMessage('');

    try {
      localStorage.setItem('goshipping_chat_history', JSON.stringify(updated));
    } catch {
      // Ignore
    }

    // Fire analytics conversion tracking
    if (typeof window !== 'undefined' && (window as any).goShippingTrack) {
      (window as any).goShippingTrack('Contact', {
        method: 'whatsapp_live_widget',
        message_snippet: trimmed.substring(0, 50),
        phone: FORMATTED_PHONE
      });
    }

    // Simulate agent acknowledgment
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const ackMsg: ChatMessage = {
        id: `ack-${Date.now()}`,
        sender: 'agent',
        text: 'Opening WhatsApp chat with our operations desk... Our representative is standing by to assist you!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, ackMsg]);

      // Direct redirect to WhatsApp
      const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(trimmed)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }, 600);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      sendToWhatsApp(inputMessage);
    }
  };

  const handleQuickTopicClick = (msg: string) => {
    sendToWhatsApp(msg);
  };

  return (
    <aside aria-label="Live Support Chat" className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 font-['Inter',sans-serif]">
      {/* 01. EXPANDED LIVE CHAT WINDOW */}
      {isOpen && (
        <div
          className="fixed inset-x-3 bottom-20 sm:bottom-20 sm:right-0 sm:left-auto sm:w-[380px] bg-white rounded-xl border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[580px] z-50 transition-all duration-200 animate-in fade-in slide-in-from-bottom-4"
          style={{ width: 'min(92vw, 380px)' }}
        >
          {/* HEADER (WhatsApp Green Brand / GoShipping Dark) */}
          <div className="bg-[#128C7E] text-white p-4 flex items-center justify-between border-b border-[#0d6e63]">
            <div className="flex items-center gap-3">
              {/* Agent Avatar with Live Beacon */}
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-white text-[#128C7E] flex items-center justify-center font-bold text-sm shadow-xs border border-white/40">
                  GS
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white ring-1 ring-emerald-500/20"></span>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm text-white font-['Manrope',sans-serif] tracking-tight leading-none">
                    GoShipping Live Support
                  </h3>
                  <svg className="w-3.5 h-3.5 text-emerald-300 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-100 mt-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                  <span>Active Now • Fast Response</span>
                </div>
              </div>
            </div>

            {/* Quick Call & Close Buttons */}
            <div className="flex items-center gap-1 text-white">
              <a
                href={`tel:${WHATSAPP_NUMBER}`}
                className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center transition-colors text-white"
                title="Call Support Directly"
                aria-label="Call Hotline"
              >
                <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </a>

              <button
                type="button"
                onClick={toggleChat}
                className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center transition-colors text-white"
                title="Close Support Window"
                aria-label="Close Support Window"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          {/* CHAT MESSAGES BODY */}
          <div
            className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#EFEAE2]/60 text-xs"
            style={{
              backgroundImage: 'radial-gradient(#CBD5E1 0.75px, transparent 0.75px)',
              backgroundSize: '16px 16px'
            }}
          >
            {/* Timestamp pill */}
            <div className="flex justify-center my-1">
              <span className="px-2.5 py-0.5 rounded-full bg-white/90 text-[10px] font-semibold text-slate-500 shadow-xs border border-slate-200/60 uppercase tracking-wider">
                Today • Dhaka (BST)
              </span>
            </div>

            {/* Conversation Bubbles */}
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 space-y-1 shadow-xs text-xs leading-relaxed ${
                      isUser
                        ? 'bg-[#DCF8C6] text-slate-900 rounded-tr-none border border-emerald-200/60'
                        : 'bg-white text-slate-900 rounded-tl-none border border-slate-200/80'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono">
                      <span>{msg.timestamp}</span>
                      {isUser && (
                        <svg className="w-3.5 h-3.5 text-[#34B7F1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 7 17l-5-5"/>
                          <path d="m22 10-7.5 7.5L13 16"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Simulated Typing Indicator */}
            {isTyping && (
              <div className="flex items-start">
                <div className="bg-white rounded-lg rounded-tl-none p-3 shadow-xs border border-slate-200/80 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.4s]"></span>
                  <span className="text-[11px] text-slate-500 ml-1">Connecting to WhatsApp...</span>
                </div>
              </div>
            )}

            {/* QUICK TOPIC SUGGESTION CHIPS */}
            <div className="pt-2 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block px-1">
                Frequent Inquiries:
              </span>
              <div className="flex flex-col gap-1.5">
                {QUICK_TOPICS.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleQuickTopicClick(topic.msg)}
                    className="w-full text-left p-2.5 rounded-lg bg-white/95 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-800 transition-colors flex items-center justify-between group shadow-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded bg-slate-100 group-hover:bg-emerald-100/70 text-slate-700 group-hover:text-emerald-700 flex items-center justify-center shrink-0 transition-colors">
                        {topic.type === 'quote' && (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="18" height="18" x="3" y="3" rx="2"/>
                            <line x1="3" x2="21" y1="9" y2="9"/>
                            <line x1="9" x2="9" y1="21" y2="9"/>
                          </svg>
                        )}
                        {topic.type === 'track' && (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                            <path d="m3.3 7 8.7 5 8.7-5"/>
                            <path d="M12 22V12"/>
                          </svg>
                        )}
                        {topic.type === 'air' && (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z" />
                          </svg>
                        )}
                        {topic.type === 'sea' && (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                            <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" />
                            <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" />
                            <line x1="12" y1="1" x2="12" y2="5" />
                          </svg>
                        )}
                        {topic.type === 'warehouse' && (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" />
                            <path d="M6 18h12" />
                            <path d="M6 14h12" />
                          </svg>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-900 group-hover:text-emerald-800">
                        {topic.label}
                      </span>
                    </div>
                    <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            <div ref={messagesEndRef} />
          </div>

          {/* FOOTER INPUT BOX */}
          <div className="p-3 bg-white border-t border-slate-200">
            <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type message or tracking code..."
                className="flex-1 h-10 px-3 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] text-slate-900 placeholder-slate-400"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim()}
                className="h-10 px-3.5 rounded-lg bg-[#25D366] hover:bg-[#20BA5A] active:bg-[#1E9E50] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                title="Send via WhatsApp"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>

            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 px-1">
              <span>Direct WhatsApp: <strong className="text-slate-600">{FORMATTED_PHONE}</strong></span>
              <span className="text-emerald-700 font-medium">9 AM - 11 PM BST</span>
            </div>
          </div>
        </div>
      )}

      {/* 02. FLOATING LAUNCHER TRIGGER PILL (Bottom Right) */}
      <div className="flex items-center gap-3">
        {/* Unread Prompt Bubble (Visible when chat is closed) */}
        {!isOpen && showNotificationBadge && (
          <div
            onClick={toggleChat}
            className="hidden sm:flex items-center gap-2 py-2 px-3.5 rounded-full bg-white border border-slate-200 shadow-md text-xs font-semibold text-slate-800 hover:border-emerald-300 cursor-pointer transition-transform hover:-translate-y-0.5 animate-in fade-in"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Live Support • WhatsApp</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">1</span>
          </div>
        )}

        {/* WhatsApp Icon Launcher Button */}
        <button
          type="button"
          onClick={toggleChat}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
            isOpen ? 'bg-slate-900 hover:bg-slate-800 ring-2 ring-slate-200' : 'bg-[#25D366] hover:bg-[#20BA5A] ring-4 ring-emerald-400/30'
          }`}
          aria-label={isOpen ? 'Close Live Support Chat' : 'Open WhatsApp Live Support'}
        >
          {isOpen ? (
            <svg className="w-6 h-6 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <>
              {/* WhatsApp Vector Icon */}
              <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.54 1.861.855 2.796.856 3.183 0 5.768-2.587 5.769-5.766.001-3.182-2.585-5.769-5.769-5.769zm3.364 8.163c-.144.405-.837.774-1.17.822-.312.043-.683.076-2.18-.544-1.916-.79-3.149-2.73-3.245-2.858-.095-.127-.778-1.034-.778-1.972 0-.938.491-1.399.666-1.59.175-.19.382-.239.508-.239.127 0 .254.001.365.006.119.006.277-.045.433.329.162.388.552 1.343.6 1.44.048.098.08.212.016.339-.064.127-.095.207-.19.317-.095.11-.2.247-.286.332-.095.095-.195.198-.084.388.111.19.494.815 1.059 1.319.728.648 1.342.85 1.533.945.19.095.302.079.413-.048.111-.127.476-.554.603-.744.127-.19.254-.159.429-.095.175.063 1.111.524 1.302.619.19.095.317.143.365.222.048.079.048.459-.095.864z"/>
              </svg>

              {/* Notification Badge Dot */}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#EA1D2C] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-xs">
                  {unreadCount}
                </span>
              )}
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
