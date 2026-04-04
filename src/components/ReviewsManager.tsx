"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase"; // Adjust path to your Supabase client
import { Trash2, MessageCircle, Check, X, Star } from "lucide-react";

export default function ReviewsManager() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State for replying
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (data) setReviews(data);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this review?")) return;
    
    await supabase.from('reviews').delete().eq('id', id);
    setReviews(reviews.filter(r => r.id !== id));
  };

  const handleReplySubmit = async (id: string) => {
    if (!replyText.trim()) return;

    // Update the database with your reply
    await supabase
      .from('reviews')
      .update({ admin_reply: replyText })
      .eq('id', id);

    // Update local state so it shows instantly without refreshing
    setReviews(reviews.map(r => r.id === id ? { ...r, admin_reply: replyText } : r));
    
    // Reset state
    setReplyingTo(null);
    setReplyText("");
  };

  if (loading) {
    return <div className="text-zinc-400 p-8">Loading reviews...</div>;
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-8">
      <h2 className="text-3xl font-bold text-white mb-8">Review Management</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reviews.map((review) => (
          <div key={review.id} className="bg-zinc-900 border border-white/10 rounded-2xl p-6 flex flex-col">
            
            {/* Header: User Info & Stars */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <img 
                  src={review.avatar_url || `https://ui-avatars.com/api/?name=${review.name}`} 
                  alt={review.name} 
                  className="w-10 h-10 rounded-full border border-white/10"
                />
                <div>
                  <h3 className="font-semibold text-white">{review.name}</h3>
                  <p className="text-xs text-zinc-500">{review.role}</p>
                </div>
              </div>
              <div className="flex text-orange-400">
                {[...Array(review.rating || 5)].map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-current" />
                ))}
              </div>
            </div>

            {/* The Review */}
            <p className="text-zinc-300 text-sm mb-6 flex-grow">
              "{review.text}"
            </p>

            {/* Admin Reply Section */}
            {review.admin_reply ? (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mb-6">
                <p className="text-xs text-orange-400 font-bold mb-1">Your Reply:</p>
                <p className="text-sm text-zinc-300">{review.admin_reply}</p>
              </div>
            ) : null}

            {/* Actions / Reply Box */}
            <div className="mt-auto pt-4 border-t border-white/5">
              {replyingTo === review.id ? (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your response..."
                    rows={3}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-orange-500/50 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setReplyingTo(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => handleReplySubmit(review.id)}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Post Reply
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <button 
                    onClick={() => {
                      setReplyingTo(review.id);
                      setReplyText(review.admin_reply || ""); // Pre-fill if editing reply
                    }}
                    className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" /> 
                    {review.admin_reply ? "Edit Reply" : "Reply"}
                  </button>
                  
                  <button 
                    onClick={() => handleDelete(review.id)}
                    className="flex items-center gap-2 text-sm text-red-400/70 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              )}
            </div>

          </div>
        ))}

        {reviews.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 text-zinc-500 border border-dashed border-white/10 rounded-2xl">
            No reviews yet. Share your portfolio link!
          </div>
        )}
      </div>
    </div>
  );
}