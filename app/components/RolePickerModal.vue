<script setup lang="ts">
import type { DanceRole, DancePartner } from '~/types/festival'
import { Button } from '~/components/ui/button'
import { Plus } from 'lucide-vue-next'
import { PartnerNameSchema, validateForm } from '#shared/validation'

const props = defineProps<{
  open: boolean
  workshopTitle: string
  rememberedRole: DanceRole | null
  partners: DancePartner[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [role: DanceRole, hasPartner: boolean, remember: boolean, partnerId?: string]
  'add-partner': [name: string]
}>()

const step = ref<'role' | 'partner' | 'pick-partner'>('role')
const selectedRole = ref<DanceRole | null>(null)
const remember = ref(true)
const newPartnerName = ref('')
const newPartner = computed(() => validateForm(PartnerNameSchema, { name: newPartnerName.value }))

watch(() => props.open, (val) => {
  if (val) {
    newPartnerName.value = ''
    if (props.rememberedRole) {
      selectedRole.value = props.rememberedRole
      step.value = 'partner'
      remember.value = true
    } else {
      selectedRole.value = null
      step.value = 'role'
      remember.value = true
    }
  }
})

function pickRole(role: DanceRole) {
  selectedRole.value = role
  step.value = 'partner'
}

function pickHasPartner(has: boolean) {
  if (has) {
    step.value = 'pick-partner'
  } else {
    emit('confirm', selectedRole.value!, false, remember.value)
    emit('update:open', false)
  }
}

function selectPartner(partnerId: string) {
  emit('confirm', selectedRole.value!, true, remember.value, partnerId)
  emit('update:open', false)
}

function createAndSelect() {
  if (!newPartner.value.success) return
  const { name } = newPartner.value.data
  emit('add-partner', name)
  // Find the partner by name after it's added (next tick)
  nextTick(() => {
    const partner = props.partners.find((p) => p.name === name)
    if (partner) {
      selectPartner(partner.id)
    }
  })
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle class="text-base">{{ workshopTitle }}</DialogTitle>
        <DialogDescription>Tell us about your role for this workshop.</DialogDescription>
      </DialogHeader>

      <!-- Step 1: Role -->
      <div v-if="step === 'role'" class="space-y-3 py-2">
        <p class="text-sm font-medium">Are you dancing as…</p>
        <div class="grid grid-cols-2 gap-3">
          <Button variant="outline" class="h-12 text-sm" @click="pickRole('lead')">
            Lead
          </Button>
          <Button variant="outline" class="h-12 text-sm" @click="pickRole('follow')">
            Follow
          </Button>
        </div>
        <Checkbox v-model="remember" class="min-h-9 gap-2 text-xs text-muted-foreground">Remember my choices for all workshops</Checkbox>
      </div>

      <!-- Step 2: Has partner? -->
      <div v-else-if="step === 'partner'" class="space-y-3 py-2">
        <p class="text-sm">
          You're joining as <span class="font-semibold">{{ selectedRole === 'lead' ? 'Lead' : 'Follow' }}</span>.
          <Button variant="link" class="ml-1 h-auto p-0 text-xs text-primary" @click="step = 'role'">Change</Button>
        </p>
        <p class="text-sm font-medium">Do you have a dance partner?</p>
        <div class="grid grid-cols-2 gap-3">
          <Button variant="outline" class="h-12 text-sm" @click="pickHasPartner(true)">
            Yes, I have a partner
          </Button>
          <Button variant="outline" class="h-12 text-sm" @click="pickHasPartner(false)">
            No, I'm looking
          </Button>
        </div>
        <Checkbox v-if="!rememberedRole" v-model="remember" class="min-h-9 gap-2 text-xs text-muted-foreground">Remember my choices for all workshops</Checkbox>
      </div>

      <!-- Step 3: Pick which partner -->
      <div v-else-if="step === 'pick-partner'" class="space-y-3 py-2">
        <p class="text-sm">
          <Button variant="link" class="h-auto p-0 text-xs text-primary" @click="step = 'partner'">← Back</Button>
        </p>
        <p class="text-sm font-medium">Who is your partner?</p>

        <!-- Existing partners -->
        <div v-if="partners.length" class="space-y-2">
          <Button
            v-for="p in partners"
            :key="p.id"
            variant="outline"
            class="w-full justify-start h-10 text-sm"
            @click="selectPartner(p.id)"
          >
            {{ p.name }}
          </Button>
        </div>

        <!-- Add new partner -->
        <div class="flex gap-2">
          <Field id="role-picker-partner-name" label="Partner's name" hide-label class="flex-1">
            <Input v-model="newPartnerName" size="sm" class="h-10" placeholder="Partner's name" @keydown.enter="createAndSelect" />
          </Field>
          <Button
            variant="outline"
            size="sm"
            class="h-10 px-3"
            :disabled="!newPartner.success"
            @click="createAndSelect"
          >
            <Plus aria-hidden="true" />
            Add
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
