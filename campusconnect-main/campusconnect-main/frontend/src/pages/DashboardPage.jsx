import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { api } from "../lib/api";
import { getSharedUserSocket } from "../lib/socket";
import { formatDateTime, formatMessageTimestamp } from "../lib/utils";

function appendUniqueMessage(messages, message) {
  if (messages.some((item) => item.id === message.id)) {
    return messages;
  }

  return [...messages, message].sort(
    (left, right) => new Date(left.createdAt) - new Date(right.createdAt)
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const { lastCreated } = useNotifications();
  const location = useLocation();

  const [dashboard, setDashboard] = useState(null);
  const [connections, setConnections] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [chatSearch, setChatSearch] = useState("");
  const [activePeerId, setActivePeerId] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [requestActionId, setRequestActionId] = useState(null);
  const [requestRejectId, setRequestRejectId] = useState(null);
  const [error, setError] = useState("");
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadDashboard() {
      try {
        const [dashboardResponse, connectionsResponse, requestsResponse] =
          await Promise.all([
            api.get(`/users/${user.id}/dashboard`),
            api.get(`/users/${user.id}/connections`),
            api.get(`/users/${user.id}/connection-requests`)
          ]);

        if (!ignore) {
          setDashboard(dashboardResponse);
          setConnections(connectionsResponse || []);
          setIncomingRequests(requestsResponse.incoming || []);

          // auto select first connection if none selected
          setActivePeerId((current) =>
            current || (connectionsResponse?.length ? connectionsResponse[0].id : null)
          );
        }
      } catch (requestError) {
        if (!ignore) {
          setError(requestError.message || "Failed to load dashboard");
        }
      }
    }

    loadDashboard();

    return () => {
      ignore = true;
    };
  }, [location.search, user.id]);

  useEffect(() => {
    if (!lastCreated?.id) return;

    if (lastCreated.type === "connection_request") {
      void api.get(`/users/${user.id}/connection-requests`).then((response) => {
        setIncomingRequests(response.incoming || []);
      });
      return;
    }

    if (lastCreated.type === "connection_accepted") {
      void api.get(`/users/${user.id}/connections`).then((response) => {
        setConnections(response || []);
      });
    }
  }, [lastCreated?.id, lastCreated?.type, user.id]);

  useEffect(() => {
    if (!activePeerId) {
      setConversation([]);
      return;
    }

    let ignore = false;

    async function loadConversation() {
      try {
        setChatError("");
        const response = await api.get(`/users/${user.id}/messages/${activePeerId}`);
        if (!ignore) {
          setConversation(response.messages || []);
        }
      } catch (requestError) {
        if (!ignore) {
          setChatError(requestError.message || "Failed to load conversation");
        }
      }
    }

    loadConversation();

    return () => {
      ignore = true;
    };
  }, [activePeerId, user.id]);

  useEffect(() => {
    const socket = getSharedUserSocket();
    if (!socket) return;

    function handleMessageCreated(message) {
      const peerId =
        message.senderId === user.id ? message.recipientId : message.senderId;

      if (peerId === activePeerId) {
        setConversation((current) => appendUniqueMessage(current, message));
      }

      setDashboard((current) => {
        if (!current) return current;

        const peer = connections.find((item) => item.id === peerId);

        const nextRecent = [
          {
            id: message.id,
            body: message.body,
            createdAt: message.createdAt,
            peer: {
              id: peerId,
              name: peer?.fullName || peer?.username || "Connected user",
              username: peer?.username || ""
            }
          },
          ...(current.recentMessages || []).filter((item) => item.id !== message.id)
        ].slice(0, 6);

        return {
          ...current,
          recentMessages: nextRecent
        };
      });
    }

    socket.on("message:created", handleMessageCreated);

    return () => {
      socket.off("message:created", handleMessageCreated);
    };
  }, [activePeerId, connections, user.id]);

  const activeConnection = useMemo(
    () => connections.find((connection) => connection.id === activePeerId) || null,
    [activePeerId, connections]
  );

  const filteredConnections = useMemo(() => {
    const query = chatSearch.trim().toLowerCase();

    if (!query) return connections;

    return connections.filter((connection) => {
      const label = `${connection.fullName || ""} ${connection.username || ""} ${
        connection.branch || ""
      }`.toLowerCase();

      return label.includes(query);
    });
  }, [chatSearch, connections]);

  // Badge logic based on QUERIES RESOLVED
  const badgeInfo = useMemo(() => {
    const resolved = dashboard?.stats?.queriesResolved || 0;

    if (resolved >= 50) {
      return {
        label: "Diamond",
        emoji: "💎",
        classes: "text-purple-600 bg-purple-100"
      };
    }
    if (resolved >= 20) {
      return {
        label: "Gold",
        emoji: "🥇",
        classes: "text-yellow-600 bg-yellow-100"
      };
    }
    if (resolved >= 10) {
      return {
        label: "Silver",
        emoji: "🥈",
        classes: "text-gray-600 bg-gray-200"
      };
    }
    if (resolved >= 5) {
      return {
        label: "Bronze",
        emoji: "🥉",
        classes: "text-orange-600 bg-orange-100"
      };
    }

    return {
      label: "No Badge",
      emoji: "🏅",
      classes: "text-gray-400 bg-gray-100"
    };
  }, [dashboard]);

  async function handleSendMessage(event) {
    event.preventDefault();

    if (!activePeerId || !draft.trim()) return;

    setSending(true);
    setChatError("");

    try {
      const message = await api.post(`/users/${user.id}/messages/${activePeerId}`, {
        body: draft.trim()
      });

      setConversation((current) => appendUniqueMessage(current, message));
      setDraft("");
    } catch (requestError) {
      setChatError(requestError.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleAcceptRequest(requestItem) {
    setRequestActionId(requestItem.requestId);
    setError("");

    try {
      const acceptedConnection = await api.post(
        `/users/${user.id}/connection-requests/${requestItem.requestId}/accept`,
        {}
      );

      setIncomingRequests((current) =>
        current.filter((item) => item.requestId !== requestItem.requestId)
      );

      setConnections((current) =>
        current.some((item) => item.id === acceptedConnection.id)
          ? current
          : [acceptedConnection, ...current]
      );

      setDashboard((current) =>
        current
          ? {
              ...current,
              stats: {
                ...current.stats,
                connectionsMade: (current.stats.connectionsMade || 0) + 1
              }
            }
          : current
      );

      if (!activePeerId) {
        setActivePeerId(acceptedConnection.id);
      }
    } catch (requestError) {
      setError(requestError.message || "Failed to accept request");
    } finally {
      setRequestActionId(null);
    }
  }

  async function handleRejectRequest(requestItem) {
    if (!window.confirm("Reject this connection request?")) return;

    setRequestRejectId(requestItem.requestId);
    setError("");

    try {
      await api.post(
        `/users/${user.id}/connection-requests/${requestItem.requestId}/reject`,
        {}
      );

      setIncomingRequests((current) =>
        current.filter((item) => item.requestId !== requestItem.requestId)
      );
    } catch (requestError) {
      setError(requestError.message || "Failed to reject request");
    } finally {
      setRequestRejectId(null);
    }
  }

  if (error) {
    return <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  if (!dashboard) {
    return <LoadingState label="Loading dashboard..." />;
  }

  const statusItems = [
    ["Basic Info", dashboard.profileStatus?.basicInfo],
    ["Academic Details", dashboard.profileStatus?.academicDetails],
    ["Career Info", dashboard.profileStatus?.careerInfo],
    ["Skills", dashboard.profileStatus?.skills]
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col justify-between gap-6 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white shadow-lg md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back, {dashboard.user.displayName}! 👋
          </h1>
          <p className="mt-2 text-sm text-blue-100 md:text-base">
            Ready to connect, guide, and grow your Campus Connect network today?
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/forum"
            className="rounded-xl bg-white/20 px-5 py-2.5 text-sm font-medium transition hover:bg-white/30"
          >
            Ask Question
          </Link>
          <Link
            to="/connect"
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 transition hover:scale-[1.02]"
          >
            Find Mentors
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Link
          to="/connections"
          className="cc-card flex items-center justify-between rounded-2xl p-6 transition hover:scale-[1.02] hover:bg-green-50"
        >
          <div>
            <p className="text-sm text-gray-500">Connections Made</p>
            <p className="text-3xl font-bold text-slate-900">
              {dashboard.stats?.connectionsMade || 0}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-2xl text-green-600">
            💬
          </div>
        </Link>

        <Link
          to="/questions"
          className="cc-card flex items-center justify-between rounded-2xl p-6 transition hover:scale-[1.02] hover:bg-purple-50"
        >
          <div>
            <p className="text-sm text-gray-500">Questions Asked</p>
            <p className="text-3xl font-bold text-slate-900">
              {dashboard.stats?.questionsAsked || 0}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-2xl text-purple-600">
            ❓
          </div>
        </Link>

        {/* FIXED: PEOPLE MENTORED */}
        <Link
          to="/people-mentored"
          className="cc-card flex items-center justify-between rounded-2xl p-6 transition hover:scale-[1.02] hover:bg-blue-50"
        >
          <div>
            <p className="text-sm text-gray-500">People Mentored</p>
            <p className="text-3xl font-bold text-slate-900">
              {dashboard.stats?.peopleMentored || 0}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-2xl text-blue-600">
            👥
          </div>
        </Link>

        {/* FIXED: QUERIES RESOLVED */}
        <Link
          to="/mentorships"
          className="cc-card flex items-center justify-between rounded-2xl p-6 transition hover:scale-[1.02] hover:bg-yellow-50"
        >
          <div>
            <p className="text-sm text-gray-500">Queries Resolved</p>
            <p className="text-3xl font-bold text-slate-900">
              {dashboard.stats?.queriesResolved || 0}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-100 text-2xl text-yellow-600">
            ✅
          </div>
        </Link>
      </div>

      {/* Badge Card */}
      <div className="cc-card rounded-2xl p-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div>
            <p className="text-sm text-gray-500">Current Badge</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {badgeInfo.emoji} {badgeInfo.label}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Badge is based on total queries resolved.
            </p>
          </div>

          <div
            className={`rounded-2xl px-6 py-4 text-xl font-bold shadow-sm ${badgeInfo.classes}`}
          >
            {badgeInfo.label}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Section */}
        <div className="space-y-6 lg:col-span-2">
          {/* Connection Requests */}
          <div className="cc-card overflow-hidden rounded-2xl">
            <div className="border-b p-5 text-lg font-semibold">Connection Requests</div>
            {incomingRequests.length ? (
              <div className="divide-y">
                {incomingRequests.map((request) => (
                  <div
                    key={request.requestId}
                    className="flex flex-col justify-between gap-4 px-5 py-4 md:flex-row md:items-center"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {request.fullName || request.username}
                      </div>
                      <div className="text-sm text-slate-500">
                        {request.course || "Student"} • {request.branch || "Campus Connect"}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Requested {formatDateTime(request.requestedAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        onClick={() => handleAcceptRequest(request)}
                        type="button"
                        disabled={
                          requestActionId === request.requestId ||
                          requestRejectId === request.requestId
                        }
                      >
                        {requestActionId === request.requestId ? "Accepting..." : "Accept"}
                      </button>

                      <button
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        onClick={() => handleRejectRequest(request)}
                        type="button"
                        disabled={
                          requestActionId === request.requestId ||
                          requestRejectId === request.requestId
                        }
                      >
                        {requestRejectId === request.requestId ? "Rejecting..." : "Reject"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-14 text-center text-gray-400">
                <div className="mb-3 text-5xl">👥</div>
                No pending connection requests
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="cc-card overflow-hidden rounded-2xl">
            <div className="border-b p-5 text-lg font-semibold">Messages</div>

            {connections.length ? (
              <div className="grid min-h-[420px] grid-cols-1 md:grid-cols-3">
                {/* Left Chat Sidebar */}
                <div className="border-r p-4 text-gray-700">
                  <div className="mb-3">
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      value={chatSearch}
                      onChange={(event) => setChatSearch(event.target.value)}
                      placeholder="Search users..."
                    />
                  </div>

                  <div className="space-y-2">
                    {filteredConnections.map((connection) => (
                      <button
                        key={connection.id}
                        className={`w-full rounded-xl px-3 py-3 text-left text-sm transition ${
                          activePeerId === connection.id
                            ? "bg-blue-100 font-medium text-blue-700"
                            : "hover:bg-gray-100"
                        }`}
                        onClick={() => setActivePeerId(connection.id)}
                      >
                        <div className="font-semibold">
                          {connection.fullName || connection.username}
                        </div>
                        <div className="text-xs text-gray-500">{connection.branch}</div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          Connected {formatDateTime(connection.connectedAt)}
                        </div>
                      </button>
                    ))}

                    {!filteredConnections.length ? (
                      <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
                        No users match your search
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Right Chat Area */}
                <div className="col-span-2 flex flex-col">
                  <div className="border-b p-4">
                    <div className="font-semibold text-slate-900">
                      {activeConnection
                        ? activeConnection.fullName || activeConnection.username
                        : "Select a connection to start chatting"}
                    </div>
                    {activeConnection ? (
                      <div className="mt-1 text-xs text-slate-400">
                        Connected {formatDateTime(activeConnection.connectedAt)}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex-1 space-y-3 bg-slate-50 p-4 overflow-y-auto">
                    {activePeerId && conversation.length ? (
                      conversation.map((message) => {
                        const mine = message.senderId === user.id;

                        return (
                          <div
                            key={message.id}
                            className={`flex ${mine ? "justify-end" : "justify-start"}`}
                          >
                            <div className={`max-w-xs ${mine ? "text-right" : "text-left"}`}>
                              <div
                                className={`rounded-2xl px-4 py-2 shadow-sm ${
                                  mine ? "bg-blue-600 text-white" : "bg-white"
                                }`}
                              >
                                {message.body}
                              </div>
                              <div className="mt-1 px-1 text-[11px] font-medium text-slate-500">
                                {formatMessageTimestamp(message.createdAt)}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-400">
                        {activePeerId ? "No messages yet" : "Select a connection to start chatting"}
                      </div>
                    )}
                  </div>

                  {chatError ? (
                    <div className="border-t bg-red-50 px-4 py-2 text-sm text-red-700">
                      {chatError}
                    </div>
                  ) : null}

                  {activePeerId ? (
                    <form
                      className="flex gap-3 border-t bg-white p-4"
                      onSubmit={handleSendMessage}
                    >
                      <input
                        className="flex-1 rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Type a message..."
                      />
                      <button
                        className="rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-700 disabled:opacity-60"
                        type="submit"
                        disabled={sending}
                      >
                        {sending ? "Sending..." : "Send"}
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="grid min-h-[360px] grid-cols-1 md:grid-cols-3">
                <div className="border-r p-4 text-gray-500">No connections yet</div>
                <div className="col-span-2 flex flex-col items-center justify-center text-gray-400">
                  <div className="mb-3 text-5xl">💬</div>
                  Select a connection to start chatting
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Profile Status */}
          <div className="cc-card overflow-hidden rounded-2xl">
            <div className="border-b p-5 text-lg font-semibold">Profile Status</div>
            <div className="space-y-3 p-5 text-sm">
              {statusItems.map(([label, done]) => (
                <div key={label} className="flex items-center justify-between">
                  <span>{label}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      done ? "bg-black text-white" : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {done ? "Complete" : "Incomplete"}
                  </span>
                </div>
              ))}

              <Link
                to="/profile"
                className="mt-4 block rounded-xl bg-blue-600 py-2.5 text-center font-medium text-white hover:bg-blue-700"
              >
                Update Profile
              </Link>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="cc-card overflow-hidden rounded-2xl">
            <div className="border-b p-5 text-lg font-semibold">Quick Actions</div>
            <div className="space-y-3 p-5">
              <Link
                to="/forum"
                className="flex w-full justify-center gap-2 rounded-xl border py-2.5 font-medium hover:bg-slate-50"
              >
                💬 Ask a Question
              </Link>
              <Link
                to="/connect"
                className="flex w-full justify-center gap-2 rounded-xl border py-2.5 font-medium hover:bg-slate-50"
              >
                👥 Find Senior Mentors
              </Link>
            </div>
          </div>

          {/* Recent Questions */}
          <div className="cc-card overflow-hidden rounded-2xl">
            <div className="border-b p-5 text-lg font-semibold">Recent Questions</div>
            {dashboard.questions?.length ? (
              <div className="space-y-4 p-5">
                {dashboard.questions.map((question) => (
                  <div
                    key={question.id}
                    className="rounded-2xl border border-slate-200 p-4 transition hover:shadow-sm"
                  >
                    <p className="mb-1 font-semibold text-slate-900">{question.title}</p>
                    <p className="text-sm text-gray-500 line-clamp-3">
                      {question.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No forum posts yet"
                description="Ask a question to start getting help from seniors and peers."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;