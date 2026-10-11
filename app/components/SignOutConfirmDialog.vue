<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

function cancel() {
  emit('update:open', false)
}

function confirm() {
  emit('confirm')
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Sign out?</DialogTitle>
        <DialogDescription>
          Are you sure you want to sign out?
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="gap-2 sm:gap-0">
        <Button variant="outline" @click="cancel">Cancel</Button>
        <Button @click="confirm">Sign out</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
