import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import LoadingState from "../components/LoadingState";
import { api } from "../lib/api";

function emptyProfile() {
  return {
    id: null,
    username: "",
    fullName: "",
    bio: "",
    course: "",
    branch: "",
    admissionYear: "",
    examPrep: "no",
    examType: "",
    internships: [],
    projects: [],
    workExperiences: [],
    skills: []
  };
}

function getFullName(profile) {
  return profile?.fullName || profile?.username || "Student";
}

function UserProfilePage() {
  const { id } = useParams();
  const [profile, setProfile] = useState(emptyProfile());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadProfile() {
      try {
        const response = await api.get(`/users/${id}`);
        if (!ignore) {
          setProfile({ ...emptyProfile(), ...response });
        }
      } catch (requestError) {
        if (!ignore) {
          setError(requestError.message || "Failed to load profile");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      ignore = true;
    };
  }, [id]);

  if (loading) {
    return <LoadingState label="Loading profile..." />;
  }

  if (error) {
    return <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between bg-white p-4 shadow">
        <h1 className="text-xl font-bold">View Profile</h1>
        <Link to="/connect" className="text-blue-600 hover:underline">
          Back to Connect
        </Link>
      </header>

      <main className="mx-auto mt-6 max-w-5xl space-y-6 px-4 pb-10">
        {/* Top Card */}
        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-3xl font-bold text-blue-700">
              {getFullName(profile)?.[0] || "S"}
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900">{getFullName(profile)}</h2>
              <p className="text-gray-600">@{profile.username || "username"}</p>
              <p className="text-gray-600">
                {profile.course || "Course not added"} {profile.branch || ""}
              </p>
              <p className="text-sm text-gray-500">
                Admission Year: {profile.admissionYear || "Not added"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4 md:col-span-2">
              <p className="text-sm font-semibold text-gray-700">Bio</p>
              <p className="text-gray-600">{profile.bio || "No bio added yet."}</p>
            </div>
          </div>
        </div>

        {/* Academic Information */}
        <div className="rounded-2xl bg-white p-6 shadow">
          <h3 className="mb-4 text-xl font-bold text-gray-900">Academic Information</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-700">Course</p>
              <p className="text-gray-600">{profile.course || "Not added"}</p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-700">Branch</p>
              <p className="text-gray-600">{profile.branch || "Not added"}</p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-700">Admission Year</p>
              <p className="text-gray-600">{profile.admissionYear || "Not added"}</p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-700">Exam Preparation</p>
              <p className="text-gray-600">
                {profile.examPrep === "yes" ? "Yes" : "No"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4 md:col-span-2">
              <p className="text-sm font-semibold text-gray-700">Exam Type</p>
              <p className="text-gray-600">{profile.examType || "Not added"}</p>
            </div>
          </div>
        </div>

        {/* Internships */}
        <div className="rounded-2xl bg-white p-6 shadow">
          <h3 className="mb-4 text-xl font-bold text-gray-900">Internships</h3>

          {profile.internships?.length > 0 ? (
            <div className="space-y-4">
              {profile.internships.map((internship, index) => (
                <div key={index} className="rounded-xl border bg-gray-50 p-5">
                  <h4 className="mb-3 text-lg font-semibold text-gray-800">
                    Internship {index + 1}
                  </h4>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Company</p>
                      <p className="text-gray-600">{internship.company || "Not added"}</p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-700">Role</p>
                      <p className="text-gray-600">{internship.role || "Not added"}</p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-700">Duration</p>
                      <p className="text-gray-600">{internship.duration || "Not added"}</p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-700">Location</p>
                      <p className="text-gray-600">{internship.location || "Not added"}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-semibold text-gray-700">Responsibilities</p>
                    <p className="text-gray-600">
                      {internship.responsibilities || "Not added"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No internships added yet.</p>
          )}
        </div>

        {/* Projects */}
        <div className="rounded-2xl bg-white p-6 shadow">
          <h3 className="mb-4 text-xl font-bold text-gray-900">Projects</h3>

          {profile.projects?.length > 0 ? (
            <div className="space-y-4">
              {profile.projects.map((project, index) => (
                <div key={index} className="rounded-xl border bg-gray-50 p-5">
                  <h4 className="mb-3 text-lg font-semibold text-gray-800">
                    Project {index + 1}
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Project Name</p>
                      <p className="text-gray-600">{project.name || "Not added"}</p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-700">GitHub Repository</p>
                      {project.github ? (
                        <a
                          href={project.github}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          {project.github}
                        </a>
                      ) : (
                        <p className="text-gray-600">Not added</p>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-700">Technology Used</p>
                      <p className="text-gray-600">{project.tech || "Not added"}</p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-700">Description</p>
                      <p className="text-gray-600">{project.description || "Not added"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No projects added yet.</p>
          )}
        </div>

        {/* Work Experience */}
        <div className="rounded-2xl bg-white p-6 shadow">
          <h3 className="mb-4 text-xl font-bold text-gray-900">Work Experience</h3>

          {profile.workExperiences?.length > 0 ? (
            <div className="space-y-4">
              {profile.workExperiences.map((work, index) => (
                <div key={index} className="rounded-xl border bg-gray-50 p-5">
                  <h4 className="mb-3 text-lg font-semibold text-gray-800">
                    Work Experience {index + 1}
                  </h4>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Company</p>
                      <p className="text-gray-600">{work.company || "Not added"}</p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-700">Role</p>
                      <p className="text-gray-600">{work.role || "Not added"}</p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-700">Duration</p>
                      <p className="text-gray-600">{work.duration || "Not added"}</p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-700">Address</p>
                      <p className="text-gray-600">{work.address || "Not added"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No work experience added yet.</p>
          )}
        </div>

        {/* Skills */}
        <div className="rounded-2xl bg-white p-6 shadow">
          <h3 className="mb-4 text-xl font-bold text-gray-900">Skills</h3>

          {profile.skills?.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {profile.skills.map((skill, index) => (
                <div key={index} className="rounded-xl border bg-gray-50 p-5">
                  <h4 className="mb-2 text-lg font-semibold text-gray-800">
                    {skill.skillName || `Skill ${index + 1}`}
                  </h4>
                  <p className="text-sm text-gray-600">
                    <strong>Proficiency:</strong> {skill.proficiencyLevel || "Not added"}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Certification:</strong> {skill.certification || "Not added"}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Issued By:</strong> {skill.issuedBy || "Not added"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No skills added yet.</p>
          )}
        </div>

        <Link
          to="/connect"
          className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Back to Connect
        </Link>
      </main>
    </div>
  );
}

export default UserProfilePage;