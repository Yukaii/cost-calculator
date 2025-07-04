<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useIngredientsStore } from '@/stores/ingredients'
import { useRecipesStore } from '@/stores/recipes'
import { useWorkspacesStore } from '@/stores/workspaces'
import Footer from './components/Footer.vue'
import AuthLogin from './components/AuthLogin.vue'
import MigrationModal from './components/MigrationModal.vue'
import ProgressToast from './components/ProgressToast.vue'
import WorkspaceInviteDialog from './components/WorkspaceInviteDialog.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import { useImportProgress } from '@/composables/useImportProgress'
import {
  PhPlus,
  PhLink,
  PhEnvelope,
  PhTrash,
  PhCaretDown,
  PhSignOut,
  PhWarning,
  PhX,
  PhWifiSlash,
  PhGlobe,
} from '@phosphor-icons/vue'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()

const authStore = useAuthStore()
const ingredientsStore = useIngredientsStore()
const recipesStore = useRecipesStore()
const workspacesStore = useWorkspacesStore()

// Dialog states
const showAuthDialog = ref(false)
const showWorkspaceDropdown = ref(false)
const showUserDropdown = ref(false)
const showCreateDialog = ref(false)
const showJoinDialog = ref(false)
const showInviteDialog = ref(false)
const showDeleteDialog = ref(false)

// Form data
const newWorkspace = ref({
  name: '',
  description: '',
})
const migratePersonalData = ref(false)
const inviteToken = ref('')

// Delete workspace state
const workspaceToDelete = ref<{ id: string; name: string } | null>(null)

const { progressState } = useImportProgress()

// Don't destructure reactive properties - use store directly for reactivity
const workspaces = computed(() => workspacesStore.workspaces)
const currentWorkspace = computed(() => workspacesStore.currentWorkspace)
const currentWorkspaceId = computed(() => workspacesStore.currentWorkspaceId)

// Actions can be destructured safely
const {
  switchToWorkspace: switchWorkspace,
  createWorkspace,
  deleteWorkspace,
  acceptInvite,
  migrateDataToWorkspace,
  initializeFromUrl,
  getUserRole,
} = workspacesStore

const currentWorkspaceName = computed(() => {
  return currentWorkspace.value?.name || t('nav.personalWorkspace')
})

// Workspace actions with router integration
const switchToPersonal = () => {
  switchWorkspace(null)
  showWorkspaceDropdown.value = false

  // Update URL to remove workspace parameter
  const currentQuery = { ...route.query }
  delete currentQuery.workspace
  router.push({ path: route.path, query: currentQuery }).catch(() => {})
}

const switchToWorkspace = (workspaceId: string) => {
  switchWorkspace(workspaceId)
  showWorkspaceDropdown.value = false

  // Update URL to include workspace parameter
  const currentQuery = { ...route.query, workspace: workspaceId }
  router.push({ path: route.path, query: currentQuery }).catch(() => {})
}

const handleCreateWorkspace = async () => {
  try {
    const workspace = await createWorkspace(
      newWorkspace.value.name.trim(),
      newWorkspace.value.description.trim(),
    )

    if (migratePersonalData.value && workspace?.id) {
      await migrateDataToWorkspace(workspace.id)
    }

    closeCreateDialog()

    if (workspace?.id) {
      switchWorkspace(workspace.id)
      // Update URL to include new workspace
      const currentQuery = { ...route.query, workspace: workspace.id }
      router.push({ path: route.path, query: currentQuery }).catch(() => {})
    }
  } catch (err) {
    console.error('Failed to create workspace:', err)
  }
}

const handleAcceptInvite = async () => {
  try {
    const workspace = await acceptInvite(inviteToken.value.trim())
    closeJoinDialog()

    if (workspace?.id) {
      switchWorkspace(workspace.id)
      // Update URL to include joined workspace
      const currentQuery = { ...route.query, workspace: workspace.id }
      router.push({ path: route.path, query: currentQuery }).catch(() => {})
    }
  } catch (err) {
    console.error('Failed to accept invitation:', err)
  }
}

const handleDeleteWorkspace = (workspaceId: string, workspaceName: string) => {
  workspaceToDelete.value = { id: workspaceId, name: workspaceName }
  showDeleteDialog.value = true
  showWorkspaceDropdown.value = false
}

const confirmDeleteWorkspace = async () => {
  if (!workspaceToDelete.value) return

  try {
    await deleteWorkspace(workspaceToDelete.value.id)
    showDeleteDialog.value = false
    workspaceToDelete.value = null

    // Update URL to remove workspace parameter if deleted workspace was active
    if (currentWorkspaceId.value === null) {
      const currentQuery = { ...route.query }
      delete currentQuery.workspace
      router.push({ path: route.path, query: currentQuery }).catch(() => {})
    }
  } catch (err) {
    console.error('Failed to delete workspace:', err)
    // Keep modal open and show error (we could add error state to modal)
  }
}

const cancelDeleteWorkspace = () => {
  showDeleteDialog.value = false
  workspaceToDelete.value = null
}

// Dialog close handlers
const closeCreateDialog = () => {
  showCreateDialog.value = false
  newWorkspace.value = { name: '', description: '' }
  migratePersonalData.value = false
}

const closeJoinDialog = () => {
  showJoinDialog.value = false
  inviteToken.value = ''
}

// User dropdown functions
const switchLanguage = () => {
  locale.value = locale.value === 'zh' ? 'en' : 'zh'
  localStorage.setItem('preferred-language', locale.value)
  showUserDropdown.value = false
}

const handleSignOut = async () => {
  try {
    await authStore.signOut()
    showUserDropdown.value = false
  } catch (err) {
    console.error('Failed to sign out:', err)
  }
}

// Click outside handler for dropdown
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Element
  if (!target.closest('.workspace-dropdown')) {
    showWorkspaceDropdown.value = false
  }
  if (!target.closest('.user-dropdown')) {
    showUserDropdown.value = false
  }
}

// Watch for URL workspace changes and sync with store
watch(
  () => route.query.workspace,
  async (workspaceId) => {
    const urlWorkspaceId = workspaceId as string | undefined
    if (urlWorkspaceId !== currentWorkspaceId.value) {
      if (authStore.isAuthenticated) {
        await initializeFromUrl(urlWorkspaceId)
      }
    }
  },
  { immediate: false },
)

// Watch for authentication changes and clean up URL
watch(
  () => authStore.isAuthenticated,
  async (isAuth) => {
    if (!isAuth && route.query.workspace) {
      // Clean up URL workspace parameter when not authenticated
      const currentQuery = { ...route.query }
      delete currentQuery.workspace
      router.replace({ path: route.path, query: currentQuery }).catch(() => {})
    }
  },
)

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)

  // Initialize workspace from URL first, then fallback to stored
  const urlWorkspaceId = route.query.workspace as string | undefined
  if (authStore.isAuthenticated) {
    await initializeFromUrl(urlWorkspaceId)
  } else {
    await workspacesStore.initializeWorkspace()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="app">
    <header>
      <div class="header-content">
        <!-- Brand Section -->
        <div class="brand-section">
          <h1>{{ t('app.title') }}</h1>
        </div>

        <!-- Main Navigation -->
        <nav class="main-nav">
          <div class="nav-links">
            <RouterLink to="/" class="nav-link">{{ t('nav.recipes') }}</RouterLink>
            <RouterLink to="/ingredients" class="nav-link">{{ t('nav.ingredients') }}</RouterLink>
          </div>
        </nav>

        <!-- User Section -->
        <div class="user-section">
          <!-- Workspace Dropdown - only show when authenticated -->
          <div v-if="authStore.isAuthenticated" class="workspace-dropdown">
            <button
              class="workspace-trigger"
              @click="showWorkspaceDropdown = !showWorkspaceDropdown"
            >
              <span class="workspace-name">
                {{ currentWorkspaceName }}
              </span>
              <PhCaretDown :size="14" class="dropdown-arrow" />
            </button>

            <div v-if="showWorkspaceDropdown" class="workspace-menu">
              <div class="workspace-section">
                <div class="workspace-section-title">{{ t('workspace.workspaces') }}</div>

                <div
                  class="workspace-option"
                  :class="{ active: !currentWorkspaceId }"
                  @click="switchToPersonal"
                >
                  <span class="workspace-option-name">{{ t('workspace.personalWorkspace') }}</span>
                  <span class="workspace-option-role">{{ t('workspace.owner') }}</span>
                </div>

                <div
                  v-for="workspace in workspaces"
                  :key="workspace.id"
                  class="workspace-option"
                  :class="{ active: currentWorkspaceId === workspace.id }"
                  @click="switchToWorkspace(workspace.id)"
                >
                  <span class="workspace-option-name">{{ workspace.name }}</span>
                  <span class="workspace-option-role">{{
                    getUserRole(workspace.id) || t('workspace.member')
                  }}</span>
                </div>
              </div>

              <div class="workspace-actions">
                <button class="workspace-action-btn" @click="showCreateDialog = true">
                  <PhPlus :size="16" />
                  {{ t('workspace.createWorkspace') }}
                </button>
                <button class="workspace-action-btn" @click="showJoinDialog = true">
                  <PhLink :size="16" />
                  {{ t('workspace.joinWorkspace') }}
                </button>
                <button
                  v-if="currentWorkspaceId"
                  class="workspace-action-btn"
                  @click="showInviteDialog = true"
                >
                  <PhEnvelope :size="16" />
                  {{ t('workspace.inviteMembers') }}
                </button>
                <button
                  v-if="currentWorkspaceId && getUserRole(currentWorkspaceId) === 'owner'"
                  class="workspace-action-btn workspace-delete-btn"
                  @click="handleDeleteWorkspace(currentWorkspaceId, currentWorkspaceName)"
                >
                  <PhTrash :size="16" />
                  {{ t('workspace.deleteWorkspace') }}
                </button>
              </div>
            </div>
          </div>

          <!-- User Account Dropdown -->
          <div v-if="authStore.isAuthenticated" class="user-dropdown">
            <button
              class="user-trigger"
              @click="showUserDropdown = !showUserDropdown"
            >
              <span class="user-email">{{ authStore.user?.email }}</span>
              <PhCaretDown :size="14" class="dropdown-arrow" />
            </button>

            <div v-if="showUserDropdown" class="user-menu">
              <div class="user-section-header">
                <div class="user-info">
                  <span class="user-email-display">{{ authStore.user?.email }}</span>
                </div>
              </div>

              <div class="user-actions">
                <button class="user-action-btn" @click="switchLanguage">
                  <PhGlobe :size="16" />
                  <span>{{ $i18n.locale === 'zh' ? $t('language.switchToEnglish') : $t('language.switchToChinese') }}</span>
                </button>
                <button class="user-action-btn sign-out-action" @click="handleSignOut">
                  <PhSignOut :size="16" />
                  {{ t('nav.signOut') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Language Switcher for non-authenticated users -->
          <LanguageSwitcher v-if="!authStore.isAuthenticated" />
        </div>
      </div>
    </header>

    <div class="main-container">
      <div v-if="authStore.isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>{{ t('app.loading') }}</p>
      </div>

      <div v-else>
        <!-- Auth banner for offline users -->
        <div v-if="!authStore.isAuthenticated" class="offline-banner">
          <div class="offline-message">
            <PhWifiSlash :size="20" class="offline-icon" />
            <span>{{ t('auth.offlineMode') }}</span>
            <button @click="showAuthDialog = true" class="auth-suggestion-btn">
              {{ t('auth.loginToSync') }}
            </button>
          </div>
        </div>

        <!-- Auth dialog overlay -->
        <div
          v-if="showAuthDialog && !authStore.isAuthenticated"
          class="auth-overlay"
          @click="showAuthDialog = false"
        >
          <div class="auth-dialog" @click.stop>
            <button class="close-auth" @click="showAuthDialog = false">
              <PhX :size="20" />
            </button>
            <AuthLogin />
          </div>
        </div>

        <RouterView />
      </div>
    </div>

    <!-- Migration Modals -->
    <MigrationModal
      :show="ingredientsStore.showMigrationModal"
      :item-count="ingredientsStore.migrationData.length"
      item-type="ingredients"
      @merge="ingredientsStore.handleMigrationMerge"
      @discard="ingredientsStore.handleMigrationDiscard"
    />

    <MigrationModal
      :show="recipesStore.showMigrationModal"
      :item-count="recipesStore.migrationData.length"
      item-type="recipes"
      @merge="recipesStore.handleMigrationMerge"
      @discard="recipesStore.handleMigrationDiscard"
    />

    <!-- Progress Toast -->
    <ProgressToast
      :visible="progressState.visible"
      :title="progressState.title"
      :percentage="progressState.percentage"
      :subtitle="progressState.subtitle"
    />

    <!-- Workspace Create Dialog -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click="closeCreateDialog">
      <div class="dialog" @click.stop>
        <div class="dialog-header">
          <h3>{{ t('workspace.createWorkspace') }}</h3>
          <button class="btn-icon" @click="closeCreateDialog">
            <X :size="18" />
          </button>
        </div>

        <form @submit.prevent="handleCreateWorkspace" class="dialog-content">
          <div class="form-group">
            <label for="workspace-name">{{ t('workspace.workspaceName') }} *</label>
            <input
              id="workspace-name"
              v-model="newWorkspace.name"
              type="text"
              required
              :placeholder="t('workspace.enterWorkspaceName')"
            />
          </div>

          <div class="form-group">
            <label for="workspace-description">{{ t('workspace.description') }}</label>
            <textarea
              id="workspace-description"
              v-model="newWorkspace.description"
              :placeholder="t('workspace.optionalDescription')"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" v-model="migratePersonalData" />
              {{ t('workspace.transferPersonalData') }}
            </label>
            <p class="form-help">
              {{ t('workspace.transferPersonalDataHelp') }}
            </p>
          </div>

          <div class="dialog-actions">
            <button type="button" class="btn-secondary" @click="closeCreateDialog">{{ t('workspace.cancel') }}</button>
            <button type="submit" class="btn-primary" :disabled="!newWorkspace.name.trim()">
              {{ t('workspace.create') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Workspace Join Dialog -->
    <div v-if="showJoinDialog" class="dialog-overlay" @click="closeJoinDialog">
      <div class="dialog" @click.stop>
        <div class="dialog-header">
          <h3>{{ t('workspace.joinWorkspace') }}</h3>
          <button class="btn-icon" @click="closeJoinDialog">
            <X :size="18" />
          </button>
        </div>

        <form @submit.prevent="handleAcceptInvite" class="dialog-content">
          <div class="form-group">
            <label for="invite-token">{{ t('workspace.invitationToken') }} *</label>
            <input
              id="invite-token"
              v-model="inviteToken"
              type="text"
              required
              :placeholder="t('workspace.enterInvitationToken')"
            />
            <p class="form-help">{{ t('workspace.invitationTokenHelp') }}</p>
          </div>

          <div class="dialog-actions">
            <button type="button" class="btn-secondary" @click="closeJoinDialog">{{ t('workspace.cancel') }}</button>
            <button type="submit" class="btn-primary" :disabled="!inviteToken.trim()">
              {{ t('workspace.join') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Workspace Invite Dialog -->
    <WorkspaceInviteDialog
      :is-open="showInviteDialog"
      :workspace-id="currentWorkspaceId"
      @close="showInviteDialog = false"
    />

    <!-- Workspace Delete Confirmation Dialog -->
    <div v-if="showDeleteDialog" class="dialog-overlay" @click="cancelDeleteWorkspace">
      <div class="dialog delete-dialog" @click.stop>
        <div class="dialog-header">
          <h3>{{ t('workspace.deleteConfirmTitle') }}</h3>
          <button class="btn-icon" @click="cancelDeleteWorkspace">
            <X :size="18" />
          </button>
        </div>

        <div class="dialog-content">
          <div class="delete-warning">
            <div class="warning-icon">
              <PhWarning :size="32" color="#e65100" />
            </div>
            <div class="warning-content">
              <p class="warning-title">{{ t('workspace.actionCannotBeUndone') }}</p>
              <p class="warning-message">
                {{ t('workspace.deleteConfirmMessage', { name: workspaceToDelete?.name }) }}
              </p>
              <p class="warning-details">
                {{ t('workspace.deleteConfirmDetails') }}
              </p>
            </div>
          </div>
        </div>

        <div class="dialog-actions">
          <button type="button" class="btn-secondary" @click="cancelDeleteWorkspace">{{ t('workspace.cancel') }}</button>
          <button
            type="button"
            class="btn-danger"
            @click="confirmDeleteWorkspace"
            :disabled="workspacesStore.isLoading"
          >
            {{ workspacesStore.isLoading ? t('workspace.deleting') : t('workspace.deleteWorkspace') }}
          </button>
        </div>
      </div>
    </div>

    <Footer />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: white;
  color: #333;
  width: 100%;
  display: flex;
  flex-direction: column;
}

header {
  background: white;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  z-index: 100;
  margin-bottom: 2rem;
  width: 100%;
}

.header-content {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 2rem;
  padding: 1rem 24px;
}

.brand-section {
  display: flex;
  align-items: center;
}

.main-nav {
  display: flex;
  justify-content: center;
}

.user-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  justify-self: end;
}

@media (min-width: 768px) {
  .header-content {
    padding-left: 32px;
    padding-right: 32px;
  }
}

@media (min-width: 1024px) {
  .header-content {
    padding-left: 40px;
    padding-right: 40px;
  }
}

h1 {
  color: #333;
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  white-space: nowrap;
}

.user-account {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
}

.user-email {
  color: #666;
}

.sign-out-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 0.2s;
}

.sign-out-btn:hover {
  background: #d32f2f;
}

.nav-links {
  display: flex;
  gap: 2rem;
  align-items: center;
}

.offline-message {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.9rem;
  color: #6c757d;
}

.offline-icon {
  flex-shrink: 0;
  color: #dc3545;
}

.nav-link {
  color: #333;
  text-decoration: none;
  font-size: 1rem;
  padding: 0.5rem 0;
  position: relative;
  transition: color 0.3s ease;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: var(--primary-color);
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.nav-link:hover {
  color: var(--primary-color);
}

.nav-link:hover::after {
  transform: scaleX(0.5);
}

.nav-link.router-link-active {
  color: var(--primary-color);
}

.nav-link.router-link-active::after {
  transform: scaleX(1);
}

/* Add styles for the import/export component */
:deep(.data-import-export) {
  padding: 0;
  margin-left: 1rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: 1rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #2196f3;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.auth-required {
  min-height: 60vh;
}

.offline-banner {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-suggestion-btn {
  background: var(--primary-color);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.auth-suggestion-btn:hover {
  background: #e55a2e;
}

.auth-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.auth-dialog {
  background: white;
  border-radius: 16px;
  padding: 2.5rem;
  max-width: 420px;
  width: 90%;
  position: relative;
  box-shadow: 
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  animation: slideUp 0.3s ease-out;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.close-auth {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  background: rgba(0, 0, 0, 0.05);
  border: none;
  cursor: pointer;
  color: #6c757d;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-auth:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #495057;
  transform: scale(1.05);
}

:deep(.data-import-export .button-group) {
  display: flex;
  gap: 0.5rem;
}

:deep(.data-import-export .export-btn),
:deep(.data-import-export .import-btn) {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.main-container {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 0 24px;
}

@media (min-width: 768px) {
  .main-container {
    padding-left: 32px;
    padding-right: 32px;
  }
}

@media (min-width: 1024px) {
  .main-container {
    padding-left: 40px;
    padding-right: 40px;
  }
}

/* Workspace Dropdown Styles */
.workspace-dropdown {
  position: relative;
}

.workspace-trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: 1px solid var(--border-color);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-color);
  transition: all 0.2s;
}

.workspace-trigger:hover {
  background: var(--background-color);
  border-color: var(--primary-color);
}

.workspace-name {
  font-weight: 500;
}

.dropdown-arrow {
  font-size: 0.7rem;
  transition: transform 0.2s;
}

.workspace-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 200;
  min-width: 280px;
  margin-top: 0.25rem;
}

.workspace-section {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-color);
}

.workspace-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 1rem;
  margin-bottom: 0.5rem;
}

.workspace-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.workspace-option:hover {
  background: #f8f9fa;
}

.workspace-option.active {
  background: var(--primary-color);
  color: white;
}

.workspace-option-name {
  font-weight: 500;
}

.workspace-option-role {
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: #f1f3f4;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
}

.workspace-actions {
  padding: 0.75rem;
}

.workspace-action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  background: none;
  border: none;
  padding: 0.75rem;
  text-align: left;
  cursor: pointer;
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--text-color);
  transition: background-color 0.2s;
  margin-bottom: 0.25rem;
}

.workspace-action-btn:hover {
  background: #f8f9fa;
}

.workspace-action-btn:last-child {
  margin-bottom: 0;
}

.workspace-delete-btn {
  background: #ffebee !important;
  color: #d32f2f !important;
}

.workspace-delete-btn:hover {
  background: #f44336 !important;
  color: white !important;
}

/* User Dropdown Styles */
.user-dropdown {
  position: relative;
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: 1px solid var(--border-color);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-color);
  transition: all 0.2s;
  max-width: 200px;
}

.user-trigger:hover {
  background: var(--background-color);
  border-color: var(--primary-color);
}

.user-trigger .user-email {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 200;
  min-width: 220px;
  margin-top: 0.25rem;
}

.user-section-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  background: #f8f9fa;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-email-display {
  font-weight: 600;
  color: var(--text-color);
  font-size: 0.875rem;
  word-break: break-all;
}

.user-actions {
  padding: 0.75rem;
}

.user-action-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  background: none;
  border: none;
  padding: 0.75rem;
  text-align: left;
  cursor: pointer;
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--text-color);
  transition: background-color 0.2s;
  margin-bottom: 0.25rem;
}

.user-action-btn:hover {
  background: #f8f9fa;
}

.user-action-btn:last-child {
  margin-bottom: 0;
}

.sign-out-action {
  color: #f44336 !important;
}

.sign-out-action:hover {
  background: #ffebee !important;
}

/* Dialog Styles */
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
  max-width: 500px;
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
.form-group textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary-color);
}

.form-group input[type='checkbox'] {
  width: auto;
  margin-right: 0.5rem;
}

.form-help {
  margin: 0.25rem 0 0 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.btn-primary,
.btn-secondary {
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

.btn-secondary {
  background: #f8f9fa;
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: #e9ecef;
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-danger {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
  font-weight: 500;
  background: #f44336;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #d32f2f;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Delete Dialog Styles */
.delete-dialog {
  max-width: 480px;
}

.delete-dialog .dialog-actions {
  padding: 1rem;
}

.delete-warning {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  padding: 1rem;
  background: #fff8e1;
  border: 1px solid #ffb74d;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.warning-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.warning-content {
  flex: 1;
}

.warning-title {
  font-weight: 600;
  color: #e65100;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.warning-message {
  color: #333;
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
}

.warning-details {
  color: #666;
  font-size: 0.875rem;
  line-height: 1.4;
  margin: 0;
}

/* Reset styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: #333;
  background: white;
}

/* Global styles */
h1,
h2,
h3,
h4,
h5,
h6 {
  color: #333;
  line-height: 1.2;
}

button {
  cursor: pointer;
}

.container {
  width: 100%;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
</style>

<style>
/* Global styles */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background: white;
  color: #333;
}

* {
  box-sizing: border-box;
}

:root {
  --primary-color: #ff6b35;
  --text-color: #333;
  --text-secondary: #666;
  --border-color: #eee;
  --background-color: white;
}
</style>
