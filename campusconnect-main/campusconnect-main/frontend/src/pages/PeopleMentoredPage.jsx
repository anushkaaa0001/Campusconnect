import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import { api } from "../lib/api";

function PeopleMentoredPage() {
  const { user } = useAuth();
  const [people, setPeople] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadPeopleMentored() {
      try {
        const response = await api.get(`/users/${user.id}/people-mentored`);
        if (!ignore) {
          setPeople(response);
        }
      } catch (requestError) {
        if (!ignore) {
          setError(requestError.message);
        }
      }
    }

    loadPeopleMentored();

    return () => {
      ignore = true;
    };
  }, [user.id]);

  if (error) {
    return <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  if (!people) {
    return <LoadingState label="Loading people mentored..." />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold">People Mentored 👥</h1>
        <p className="mt-2 text-sm text-blue-100 md:text-base">
          These are the users whose questions you successfully resolved.
        </p>
      </div>

      {people.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {people.map((person) => (
            <div
              key={person.id}
              className="cc-card rounded-2xl border border-slate-200 p-5 transition hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
                  {(person.name || person.username || "U").charAt(0).toUpperCase()}
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {person.name || person.username}
                  </h2>
                  <p className="text-sm text-slate-500">@{person.username}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No people mentored yet"
          description="Once your answers get marked as resolved, the users you helped will appear here."
        />
      )}
    </div>
  );
}

export default PeopleMentoredPage;