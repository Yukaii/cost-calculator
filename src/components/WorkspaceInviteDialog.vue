<template>
  <div v-if="isOpen" class="dialog-overlay" @click="closeDialog">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3>Invite Members</h3>
        <button class="btn-icon" @click="closeDialog">×</button>
      </div>

      <div class="dialog-content">
        <!-- Invite Form -->
        <form @submit.prevent="handleSendInvite" class="invite-form">
          <div class="form-group">
            <label for="invite-email">Email Address *</label>
            <input
              id="invite-email"
              v-model="inviteForm.email"
              type="email"
              required
              placeholder="Enter email address"
            />
          </div>

          <div class="form-group">
            <label for="invite-role">Role *</label>
            <select id="invite-role" v-model="inviteForm.role" required>
              <option value="editor">Editor - Can create and edit content</option>
              <option value="viewer">Viewer - Can only view content</option>
            </select>
          </div>

          <div class="form-actions">
            <button
              type="submit"
              class="btn-primary"
              :disabled="isLoading || !inviteForm.email.trim()"
            >
              {{ isLoading ? 'Sending...' : 'Send Invitation' }}
            </button>
          </div>
        </form>

        <!-- Active Invitations -->
        <div v-if="pendingInvites.length > 0" class="pending-invites">
          <h4>Pending Invitations</h4>
          <div class="invite-list">
            <div v-for="invite in pendingInvites" :key="invite.id" class="invite-item">
              <div class="invite-info">
                <div class="invite-email">{{ invite.email }}</div>
                <div class="invite-details">
                  <span class="invite-role">{{ invite.role }}</span>
                  <span class="invite-expires">
                    Expires {{ formatExpiryDate(invite.expiresAt) }}
                  </span>
                </div>
              </div>
              <div class="invite-actions">
                <button
                  class="btn-copy"
                  @click="copyInviteToken(invite.token)"
                  title="Copy invitation token"
                >
                  Copy Token
                </button>
                <button
                  class="btn-danger-small"
                  @click="revokeInvite(invite.id)"
                  title="Revoke invitation"
                >
                  Revoke
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Current Members -->
        <div v-if="members.length > 0" class="current-members">
          <h4>Current Members</h4>
          <div class="member-list">
            <div v-for="member in members" :key="member.id" class="member-item">
              <div class="member-info">
                <div class="member-email">{{ member.$user.email }}</div>
                <div class="member-role">{{ member.role }}</div>
              </div>
              <div class="member-actions" v-if="member.role !== 'owner'">
                <button
                  class="btn-danger-small"
                  @click="handleRemoveMember(member.id)"
                  title="Remove member"
                  :disabled="isLoading"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Success Message -->
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>

      <!-- Error Message -->
      <div v-if="error" class="error-message">
        {{ error }}
        <button @click="clearError">×</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useWorkspacesStore, type WorkspaceMember, type WorkspaceInvite } from '@/stores/workspaces'

interface Props {
  isOpen: boolean
  workspaceId: string | null
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const workspacesStore = useWorkspacesStore()
const { isLoading, error, inviteToWorkspace, getWorkspaceMembers, removeMember, clearError } =
  workspacesStore

// Form state
const inviteForm = ref({
  email: '',
  role: 'editor' as 'editor' | 'viewer',
})

// Data state
const members = ref<WorkspaceMember[]>([])
const pendingInvites = ref<WorkspaceInvite[]>([])
const successMessage = ref('')

const closeDialog = () => {
  emit('close')
  // Reset form
  inviteForm.value = { email: '', role: 'editor' }
  successMessage.value = ''
  clearError()
}

const handleSendInvite = async () => {
  if (!props.workspaceId) return

  try {
    const token = await inviteToWorkspace(
      props.workspaceId,
      inviteForm.value.email.trim(),
      inviteForm.value.role,
    )

    // Show success with token
    successMessage.value = `Invitation sent! Token: ${token}`

    // Reset form
    inviteForm.value = { email: '', role: 'editor' }

    // Refresh invites list
    await loadPendingInvites()
  } catch (err) {
    console.error('Failed to send invitation:', err)
  }
}

const copyInviteToken = async (token: string) => {
  try {
    await navigator.clipboard.writeText(token)
    successMessage.value = 'Invitation token copied to clipboard!'
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err) {
    console.error('Failed to copy token:', err)
  }
}

const revokeInvite = async (inviteId: string) => {
  // TODO: Implement revoke invite functionality
  console.log('Revoking invite:', inviteId)
}

const handleRemoveMember = async (memberId: string) => {
  if (!props.workspaceId) return

  if (confirm('Are you sure you want to remove this member?')) {
    try {
      await removeMember(props.workspaceId, memberId)
      await loadMembers()
    } catch (err) {
      console.error('Failed to remove member:', err)
    }
  }
}

const loadMembers = async () => {
  if (!props.workspaceId) return

  try {
    const membersData = await getWorkspaceMembers(props.workspaceId)
    members.value = membersData
  } catch (err) {
    console.error('Failed to load members:', err)
  }
}

const loadPendingInvites = async () => {
  if (!props.workspaceId) return

  // TODO: Implement loading pending invites
  // This would require a query to get workspace_invites for the current workspace
  pendingInvites.value = []
}

const formatExpiryDate = (date: Date) => {
  return new Date(date).toLocaleDateString()
}

// Load data when dialog opens
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen && props.workspaceId) {
      loadMembers()
      loadPendingInvites()
    }
  },
)

onMounted(() => {
  if (props.isOpen && props.workspaceId) {
    loadMembers()
    loadPendingInvites()
  }
})
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.dialog-header h3 {
  margin: 0;
  color: var(--text-color);
}

.btn-icon {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem;
  color: var(--text-secondary);
  border-radius: 4px;
  transition: background-color 0.2s;
}

.btn-icon:hover {
  background: #f5f5f5;
}

.dialog-content {
  padding: 1rem;
}

.invite-form {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-color);
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--primary-color);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.pending-invites,
.current-members {
  margin-bottom: 1.5rem;
}

.pending-invites h4,
.current-members h4 {
  margin: 0 0 1rem 0;
  color: var(--text-color);
  font-size: 1rem;
}

.invite-list,
.member-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.invite-item,
.member-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: #f8f9fa;
}

.invite-info,
.member-info {
  flex: 1;
}

.invite-email,
.member-email {
  font-weight: 500;
  margin-bottom: 0.25rem;
  color: var(--text-color);
}

.invite-details {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.invite-role,
.member-role {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  background: #f1f3f4;
  border-radius: 12px;
  color: var(--text-secondary);
  text-transform: capitalize;
}

.invite-actions,
.member-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-primary,
.btn-copy,
.btn-danger-small {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
  font-weight: 500;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #e55a2e;
}

.btn-copy {
  background: #f8f9fa;
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.btn-copy:hover {
  background: #e9ecef;
}

.btn-danger-small {
  background: #ffebee;
  color: #d32f2f;
  font-size: 0.75rem;
  padding: 0.375rem 0.75rem;
}

.btn-danger-small:hover:not(:disabled) {
  background: #f44336;
  color: white;
}

.btn-primary:disabled,
.btn-danger-small:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.success-message {
  background: #e8f5e8;
  color: #2e7d32;
  padding: 0.75rem;
  border-radius: 4px;
  margin: 1rem;
  word-break: break-all;
  border: 1px solid #c8e6c9;
}

.error-message {
  background: #ffebee;
  color: #d32f2f;
  padding: 0.75rem;
  border-radius: 4px;
  margin: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #ffcdd2;
}

.error-message button {
  background: none;
  border: none;
  color: #d32f2f;
  cursor: pointer;
  font-size: 1.25rem;
  padding: 0;
}
</style>
