import { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  User, Mail, Shield, Calendar, LogOut, ArrowLeft, 
  CheckCircle2, RefreshCw, AlertTriangle, Github, KeyRound, Sparkles,
  Link2, Unlink, Lock, Eye, EyeOff, AlertCircle
} from 'lucide-react';
import { ROUTES } from '../constants/routes';
import { getCurrentUser, logout, changePassword } from '../services/auth.service';
import { 
  getGithubStatus, 
  getGithubConnectUrl, 
  disconnectGithub, 
  GithubStatus 
} from '../services/github.service';
import { useCanvasSky } from '../utils/useCanvasSky';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  provider?: string;
  emailVerified?: boolean;
  createdAt?: string;
}

export default function Profile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<boolean>(false);

  // GitHub Connection State
  const [githubStatus, setGithubStatus] = useState<GithubStatus | null>(null);
  const [loadingGithub, setLoadingGithub] = useState<boolean>(true);
  const [githubActionLoading, setGithubActionLoading] = useState<boolean>(false);
  const [githubMessage, setGithubMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<boolean>(false);

  // Change Password State (credentials only)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load User and GitHub status
  const fetchProfileAndGithub = async () => {
    try {
      setLoading(true);
      setError(null);
      const userData = await getCurrentUser();
      if (userData?.success && userData?.user) {
        setUser(userData.user);
      } else {
        setError('Failed to retrieve user profile data.');
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setError(errorObj.response?.data?.message || errorObj.message || 'Unable to connect to authentication server');
    } finally {
      setLoading(false);
    }

    try {
      setLoadingGithub(true);
      const ghData = await getGithubStatus();
      setGithubStatus(ghData);
    } catch (err) {
      console.error('Failed to load GitHub status:', err);
    } finally {
      setLoadingGithub(false);
    }
  };

  useEffect(() => {
    fetchProfileAndGithub();
  }, []);

  // Check URL params for OAuth redirect results
  useEffect(() => {
    const ghSuccess = searchParams.get('github_success');
    const ghError = searchParams.get('github_error');

    if (ghError) {
      if (ghError === 'account_already_linked') {
        setGithubMessage({
          type: 'error',
          text: 'This GitHub account is already connected to another HAVN account. To link it here, you must first disconnect it from the other account.'
        });
      } else if (ghError === 'access_denied') {
        setGithubMessage({
          type: 'error',
          text: 'GitHub authorization was cancelled or denied.'
        });
      } else {
        setGithubMessage({
          type: 'error',
          text: 'Failed to connect GitHub account. Please try again.'
        });
      }
      navigate(ROUTES.PROFILE, { replace: true });
    } else if (ghSuccess) {
      setGithubMessage({
        type: 'success',
        text: 'GitHub account successfully connected!'
      });
      navigate(ROUTES.PROFILE, { replace: true });
      getGithubStatus().then(setGithubStatus).catch(() => {});
    }
  }, [searchParams, navigate]);

  useCanvasSky(canvasRef, { cloudCount: 24, baseSpeed: 0.7 });

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  const getInitials = (name?: string, email?: string): string => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.trim().substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'HV';
  };

  // Connect GitHub OAuth flow
  const handleConnectGithub = async () => {
    setGithubActionLoading(true);
    setGithubMessage(null);
    try {
      const url = await getGithubConnectUrl();
      if (url) {
        window.location.href = url;
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setGithubMessage({
        type: 'error',
        text: errorObj.response?.data?.message || errorObj.message || 'Failed to initiate GitHub connection.'
      });
      setGithubActionLoading(false);
    }
  };

  // Disconnect GitHub with confirmation
  const handleDisconnectGithub = async () => {
    setGithubActionLoading(true);
    setGithubMessage(null);
    try {
      const result = await disconnectGithub();
      if (result.success) {
        setGithubMessage({
          type: 'success',
          text: 'GitHub account has been disconnected. You can connect a different GitHub account whenever you like.'
        });
        setGithubStatus({ connected: false, github: null });
        setShowDisconnectConfirm(false);
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setGithubMessage({
        type: 'error',
        text: errorObj.response?.data?.message || errorObj.message || 'Failed to disconnect GitHub account.'
      });
    } finally {
      setGithubActionLoading(false);
    }
  };

  // Change Password submit handler
  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordMessage({ type: 'error', text: 'Please enter your current password.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await changePassword({ currentPassword, newPassword });
      setPasswordMessage({ type: 'success', text: res.message || 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setPasswordMessage({
        type: 'error',
        text: errorObj.response?.data?.message || errorObj.message || 'Failed to update password.'
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div id="profile-account-center" className="min-h-screen flex flex-col relative overflow-x-hidden font-sans selection:bg-sky-200 dark:selection:bg-slate-700">
      
      {/* Dynamic Animated Sky Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none z-0"
      />

      <div className="pt-24 sm:pt-28 pb-16 flex-1 flex flex-col relative z-20 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Top Breadcrumb & Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(ROUTES.DASHBOARD)}
            className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-white/60 hover:bg-white/80 dark:bg-[#16191f]/80 dark:hover:bg-[#1e222b] border border-white/80 dark:border-[#282d37] px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-400 bg-white/40 dark:bg-[#16191f]/60 px-3 py-1 rounded-lg border border-white/60 dark:border-[#282d37]">
            Account Center
          </span>
        </div>

        {loading ? (
          <div className="text-center py-24 backdrop-blur-2xl bg-white/60 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl p-8 space-y-4 shadow-xl shadow-sky-950/10 dark:shadow-none">
            <RefreshCw className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Loading authenticated account profile...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 backdrop-blur-2xl bg-red-50/90 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-3xl p-8 space-y-3 shadow-xl dark:shadow-none">
            <AlertTriangle className="w-10 h-10 text-red-500 dark:text-red-400 mx-auto" />
            <h2 className="text-base font-extrabold text-slate-900 dark:text-[#f1f3f5]">Failed to load profile</h2>
            <p className="text-xs text-red-600 dark:text-red-400 font-semibold">{error}</p>
            <button
              type="button"
              onClick={fetchProfileAndGithub}
              className="mt-4 px-4 py-2 bg-slate-900 hover:bg-black dark:bg-[#1e222b] dark:hover:bg-[#282d37] dark:border dark:border-[#282d37] text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Try Again
            </button>
          </div>
        ) : user ? (
          <div className="space-y-6">
            {/* Main Profile Header Card */}
            <div className="backdrop-blur-2xl bg-white/60 hover:bg-white/65 dark:bg-[#16191f]/80 dark:hover:bg-[#16191f]/90 border border-white/90 dark:border-[#282d37] rounded-3xl p-6 sm:p-8 shadow-xl shadow-sky-950/10 dark:shadow-none transition-all duration-300 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  {user.avatar && !avatarError ? (
                    <img
                      src={user.avatar}
                      alt={user.name || 'User Avatar'}
                      onError={() => setAvatarError(true)}
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-white/90 dark:border-[#282d37] shadow-md shadow-blue-600/30"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold flex items-center justify-center text-2xl border-2 border-white/90 dark:border-[#282d37] shadow-md shadow-blue-600/30">
                      {getInitials(user.name, user.email)}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-[#f1f3f5] tracking-tight">
                        {user.name || (user.email ? user.email.split('@')[0] : 'dev-master')}
                      </h1>
                      <span className="text-[11px] bg-blue-100/90 dark:bg-blue-950/50 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 px-2.5 py-0.5 rounded-full font-bold shadow-2xs capitalize">
                        {user.provider ? `${user.provider} account` : 'Hobby Plan'}
                      </span>
                      {user.emailVerified && (
                        <span className="flex items-center gap-1 text-[11px] bg-emerald-100/90 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-0.5 rounded-full font-bold shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Verified Email
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> {user.email}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full sm:w-auto px-5 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                  Sign Out
                </button>
              </div>
            </div>

            {/* Grid: Personal Identity & Connected Accounts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* PERSONAL IDENTITY DETAILS */}
              <div className="backdrop-blur-2xl bg-white/60 hover:bg-white/65 dark:bg-[#16191f]/80 dark:hover:bg-[#16191f]/90 border border-white/90 dark:border-[#282d37] rounded-3xl p-6 space-y-4 shadow-xl shadow-sky-950/10 dark:shadow-none flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[#282d37] pb-3">
                    <h2 className="text-sm font-extrabold text-slate-900 dark:text-[#f1f3f5] flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Personal Identity
                    </h2>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Account</span>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div>
                      <span className="text-slate-600 dark:text-slate-400 font-bold block mb-1">Full Name</span>
                      <p className="text-slate-900 dark:text-[#f1f3f5] font-bold bg-white/80 dark:bg-[#12151a] border border-white/90 dark:border-[#282d37] px-3.5 py-2.5 rounded-xl shadow-xs">
                        {user.name || 'Not provided'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-600 dark:text-slate-400 font-bold block mb-1">Email Address</span>
                      <div className="flex items-center justify-between bg-white/80 dark:bg-[#12151a] border border-white/90 dark:border-[#282d37] px-3.5 py-2.5 rounded-xl shadow-xs">
                        <span className="text-slate-900 dark:text-[#f1f3f5] font-bold truncate mr-2">{user.email}</span>
                        {user.emailVerified ? (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                            Unverified
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-600 dark:text-slate-400 font-bold block mb-1">Member Since</span>
                      <p className="text-slate-800 dark:text-slate-200 font-semibold bg-white/80 dark:bg-[#12151a] border border-white/90 dark:border-[#282d37] px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : 'Active Workspace'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium border-t border-slate-200/60 dark:border-[#282d37] mt-4">
                  Profile information is shared across your workspace and deployments.
                </div>
              </div>

              {/* CONNECTED ACCOUNTS SECTION */}
              <div className="backdrop-blur-2xl bg-white/60 hover:bg-white/65 dark:bg-[#16191f]/80 dark:hover:bg-[#16191f]/90 border border-white/90 dark:border-[#282d37] rounded-3xl p-6 space-y-4 shadow-xl shadow-sky-950/10 dark:shadow-none flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[#282d37] pb-3">
                    <h2 className="text-sm font-extrabold text-slate-900 dark:text-[#f1f3f5] flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Connected Accounts
                    </h2>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Integrations</span>
                  </div>

                  {githubMessage && (
                    <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      githubMessage.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                    }`}>
                      {githubMessage.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      )}
                      <span>{githubMessage.text}</span>
                    </div>
                  )}

                  {/* GitHub Item */}
                  <div className="bg-white/70 dark:bg-[#12151a] border border-white/90 dark:border-[#282d37] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-[#1e222b] text-white flex items-center justify-center shadow-md border dark:border-[#282d37]">
                          <Github className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900 dark:text-[#f1f3f5]">GitHub</p>
                            {loadingGithub ? (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Checking...</span>
                            ) : githubStatus?.connected ? (
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full font-bold">
                                Connected
                              </span>
                            ) : (
                              <span className="text-[10px] bg-slate-100 dark:bg-[#1e222b] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#282d37] px-2 py-0.5 rounded-full font-bold">
                                Not Connected
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            {githubStatus?.connected && githubStatus.github
                              ? `@${githubStatus.github.username}`
                              : 'Link your repositories for deployments'}
                          </p>
                        </div>
                      </div>

                      {!loadingGithub && (
                        <div>
                          {githubStatus?.connected ? (
                            <button
                              type="button"
                              onClick={() => setShowDisconnectConfirm(true)}
                              disabled={githubActionLoading}
                              className="px-3.5 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900/50 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Unlink className="w-3.5 h-3.5" /> Disconnect
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleConnectGithub}
                              disabled={githubActionLoading}
                              className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-black dark:bg-[#1e222b] dark:hover:bg-[#282d37] dark:border dark:border-[#282d37] rounded-xl transition-all shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {githubActionLoading ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Link2 className="w-3.5 h-3.5" />
                              )}
                              Connect
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Disconnect Confirmation Prompt */}
                    {showDisconnectConfirm && (
                      <div className="pt-3 border-t border-slate-200/80 dark:border-[#282d37] space-y-2.5 animate-fadeIn">
                        <div className="p-3 bg-red-50/90 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs space-y-2">
                          <p className="font-bold text-red-900 dark:text-red-300">Disconnect GitHub Account?</p>
                          <p className="text-red-700 dark:text-red-400 text-[11px] leading-relaxed">
                            This will unlink <strong>@{githubStatus?.github?.username}</strong> from your HAVN workspace. You can connect a different account anytime.
                          </p>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleDisconnectGithub}
                              disabled={githubActionLoading}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {githubActionLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                              Confirm Disconnect
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowDisconnectConfirm(false)}
                              disabled={githubActionLoading}
                              className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-[#1e222b] dark:hover:bg-[#282d37] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#282d37] rounded-lg font-semibold text-xs transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium border-t border-slate-200/60 dark:border-[#282d37] mt-4">
                  A GitHub account is tied exclusively to one HAVN workspace. To link another GitHub identity, disconnect first.
                </div>
              </div>
            </div>

            {/* SECURITY & SIGN-IN SECTION */}
            <div className="backdrop-blur-2xl bg-white/60 hover:bg-white/65 dark:bg-[#16191f]/80 dark:hover:bg-[#16191f]/90 border border-white/90 dark:border-[#282d37] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl shadow-sky-950/10 dark:shadow-none">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[#282d37] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-[#f1f3f5]">Security & Sign-in</h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Manage authentication credentials and sign-in methods</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-[#12151a] border border-white/90 dark:border-[#282d37] px-3 py-1.5 rounded-xl capitalize shadow-xs">
                  {user.provider === 'github' ? (
                    <>
                      <Github className="w-4 h-4 text-slate-900 dark:text-white" /> GitHub OAuth
                    </>
                  ) : user.provider === 'google' ? (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-500" /> Google OAuth
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Password Credentials
                    </>
                  )}
                </div>
              </div>

              {/* Conditional Password Change Form for Credentials Users */}
              {user.provider === 'credentials' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    <h3 className="text-xs font-extrabold text-slate-900 dark:text-[#f1f3f5] uppercase tracking-wider">Change Password</h3>
                  </div>

                  {passwordMessage && (
                    <div className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
                      passwordMessage.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                    }`}>
                      {passwordMessage.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      )}
                      <span>{passwordMessage.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="current-password" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Current Password</label>
                      <div className="relative">
                        <input
                          id="current-password"
                          name="currentPassword"
                          autoComplete="current-password"
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full text-xs font-medium bg-white/80 dark:bg-[#12151a] border border-slate-200 dark:border-[#282d37] focus:border-blue-500 dark:focus:border-blue-500 rounded-xl px-3 py-2.5 pr-8 text-slate-900 dark:text-[#f1f3f5] placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="new-password" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">New Password (8+ chars)</label>
                      <div className="relative">
                        <input
                          id="new-password"
                          name="newPassword"
                          autoComplete="new-password"
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          minLength={8}
                          className="w-full text-xs font-medium bg-white/80 dark:bg-[#12151a] border border-slate-200 dark:border-[#282d37] focus:border-blue-500 dark:focus:border-blue-500 rounded-xl px-3 py-2.5 pr-8 text-slate-900 dark:text-[#f1f3f5] placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="confirm-password" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Confirm New Password</label>
                      <div className="flex items-center gap-2">
                        <input
                          id="confirm-password"
                          name="confirmPassword"
                          autoComplete="new-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full text-xs font-medium bg-white/80 dark:bg-[#12151a] border border-slate-200 dark:border-[#282d37] focus:border-blue-500 dark:focus:border-blue-500 rounded-xl px-3 py-2.5 text-slate-900 dark:text-[#f1f3f5] outline-none transition-all shadow-xs"
                        />
                        <button
                          type="submit"
                          disabled={passwordLoading}
                          className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          {passwordLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                          Update
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="bg-white/70 dark:bg-[#12151a] border border-white/90 dark:border-[#282d37] rounded-2xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-[#f1f3f5]">Managed by External Identity Provider</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-0.5 leading-relaxed">
                      You are signed in using <strong>{user.provider === 'github' ? 'GitHub' : 'Google'} OAuth</strong>. Your password and authentication security are managed directly through your {user.provider === 'github' ? 'GitHub' : 'Google'} account settings.
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : null}
      </div>
    </div>
  );
}