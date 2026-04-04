"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase"; 
import { Send, LogOut, User, Clock, Search, ShieldCheck, MessageSquare, Star } from "lucide-react";
import ReviewsManager from "../components/ReviewsManager";

export default function AdminDashboard() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Dashboard State
  const [activeTab, setActiveTab] = useState<"chat" | "reviews">("chat");

  // Chat State
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 1. Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchAllConversations();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchAllConversations();
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch & Group All Messages
  const fetchAllConversations = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return;
    }

    if (data) {
      const grouped: Record<string, any> = {};
      data.forEach((msg) => {
        if (!grouped[msg.sender_id]) {
          grouped[msg.sender_id] = {
            id: msg.sender_id,
            email: msg.sender_email,
            messages: []
          };
        }
        grouped[msg.sender_id].messages.push(msg);
      });

      const contactsArray = Object.values(grouped).sort((a, b) => {
        const lastMsgA = new Date(a.messages[a.messages.length - 1].created_at).getTime();
        const lastMsgB = new Date(b.messages[b.messages.length - 1].created_at).getTime();
        return lastMsgB - lastMsgA;
      });

      setContacts(contactsArray);
      
      if (selectedUser) {
        const updatedSelected = contactsArray.find(c => c.id === selectedUser.id);
        if (updatedSelected) setMessages(updatedSelected.messages);
      }
    }
  };

  // 3. Realtime Listener (Notifications)
  useEffect(() => {
    if (!session) return;

    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }

    const channel = supabase
      .channel('admin-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          fetchAllConversations();
          if (!payload.new.is_admin) {
            if ("Notification" in window && Notification.permission === "granted") {
              if (document.hidden) { 
                new Notification("New Portfolio Message!", {
                  body: `${payload.new.sender_email} says: "${payload.new.text}"`,
                  icon: "/globe.png" 
                });
              }
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session, selectedUser]);

  // Auto-scroll for chat
  useEffect(() => {
    if (activeTab === "chat" && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  // Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setContacts([]);
    setSelectedUser(null);
  };

  const selectContact = (contact: any) => {
    setSelectedUser(contact);
    setMessages(contact.messages);
    // If on mobile, you might want to force switch to chat tab here if they were on reviews
    if (activeTab !== "chat") setActiveTab("chat");
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedUser) return;

    const textToSend = replyText;
    setReplyText("");

    await supabase.from('messages').insert([{
      sender_id: selectedUser.id,
      sender_email: session.user.email,
      text: textToSend,
      is_admin: true
    }]);
  };

  // --- UI: LOGIN SCREEN ---
  if (!session) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center border border-orange-500/20">
              <ShieldCheck className="w-8 h-8 text-orange-500" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white text-center mb-2">Command Center</h2>
          <p className="text-zinc-400 text-center text-sm mb-8">Secure administrative access only.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Admin Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-white outline-none focus:border-orange-500/50 transition-colors"
                required
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Passphrase"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-white outline-none focus:border-orange-500/50 transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 text-white font-medium py-3.5 rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Establish Connection"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- UI: MAIN DASHBOARD ---
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col md:flex-row text-white overflow-hidden">
      
      {/* LEFT SIDEBAR */}
      <div className="w-full md:w-80 lg:w-96 border-r border-white/10 flex flex-col bg-zinc-900/30 h-screen shrink-0">
        {/* Sidebar Header */}
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-4 bg-zinc-900/50">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orange-500" /> HQ
          </h2>
          <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="p-4 border-b border-white/10 space-y-2 bg-zinc-900/20">
          <button 
            onClick={() => setActiveTab("chat")} 
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-medium ${
              activeTab === "chat" 
                ? "bg-orange-500/10 text-orange-500 border border-orange-500/20" 
                : "text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent"
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Live Messages
          </button>
          <button 
            onClick={() => setActiveTab("reviews")} 
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-medium ${
              activeTab === "reviews" 
                ? "bg-orange-500/10 text-orange-500 border border-orange-500/20" 
                : "text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent"
            }`}
          >
            <Star className="w-4 h-4" /> Reviews Manager
          </button>
        </div>

        {/* Dynamic Sidebar Content (Only show search/contacts when in Chat mode) */}
        {activeTab === "chat" && (
          <>
            <div className="p-4 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Search conversations..." 
                  className="w-full bg-black/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-orange-500/50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {contacts.map((contact) => {
                const lastMessage = contact.messages[contact.messages.length - 1];
                const isSelected = selectedUser?.id === contact.id;

                return (
                  <div 
                    key={contact.id}
                    onClick={() => selectContact(contact)}
                    className={`p-3 rounded-xl cursor-pointer transition-colors flex items-start gap-3 ${
                      isSelected ? "bg-orange-500/10 border border-orange-500/20" : "hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-white/5">
                      <User className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className="font-medium text-sm truncate text-white">{contact.email}</h3>
                        <span className="text-[10px] text-zinc-500 shrink-0 ml-2">
                          {new Date(lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${!lastMessage.is_admin ? "text-zinc-300 font-medium" : "text-zinc-500"}`}>
                        {lastMessage.is_admin ? "You: " : ""}{lastMessage.text}
                      </p>
                    </div>
                  </div>
                );
              })}
              {contacts.length === 0 && (
                <div className="text-center p-8 text-zinc-500 text-sm">
                  No active conversations yet.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* RIGHT SIDE: Main Content Area */}
      <div className="flex-1 flex flex-col h-screen bg-[#0A0A0A] overflow-y-auto">
        
        {/* CONDITIONAL RENDERING: Review Manager OR Live Chat */}
        {activeTab === "reviews" ? (
          <ReviewsManager />
        ) : selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-white/10 flex items-center px-6 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10 shrink-0">
              <div>
                <h3 className="font-bold text-white">{selectedUser.email}</h3>
                <p className="text-xs text-zinc-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Session Active
                </p>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg: any) => (
                <div key={msg.id} className={`flex flex-col ${msg.is_admin ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm ${
                    msg.is_admin 
                      ? "bg-orange-500 text-white rounded-tr-sm" 
                      : "bg-zinc-800 text-zinc-100 rounded-tl-sm border border-white/5"
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 px-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-zinc-900/50 border-t border-white/10 shrink-0">
              <form onSubmit={handleSendReply} className="relative flex items-center max-w-4xl mx-auto">
                <input
                  type="text"
                  placeholder="Type your reply to the guest..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-full pl-6 pr-14 py-3.5 text-white placeholder:text-zinc-500 outline-none focus:border-orange-500/50 transition-colors shadow-inner"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="absolute right-2 p-2.5 bg-orange-500 hover:bg-orange-600 rounded-full text-white disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4 translate-x-[-1px] translate-y-[1px]" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 space-y-4">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
              <MessageSquare className="w-8 h-8 text-zinc-600" />
            </div>
            <p>Select a conversation from the sidebar to start responding.</p>
          </div>
        )}
      </div>
      
    </div>
  );
}