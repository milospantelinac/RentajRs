<template>
  <div class="rte">
    <div v-if="editor" class="rte-toolbar">
      <button
        type="button"
        class="rte-btn"
        :class="{ 'rte-btn-active': editor.isActive('bold') }"
        @click="editor.chain().focus().toggleBold().run()"
      ><strong>B</strong></button>
      <button
        type="button"
        class="rte-btn"
        :class="{ 'rte-btn-active': editor.isActive('italic') }"
        @click="editor.chain().focus().toggleItalic().run()"
      ><em>I</em></button>
      <button
        type="button"
        class="rte-btn"
        :class="{ 'rte-btn-active': editor.isActive('heading', { level: 2 }) }"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
      >H2</button>
      <button
        type="button"
        class="rte-btn"
        :class="{ 'rte-btn-active': editor.isActive('bulletList') }"
        @click="editor.chain().focus().toggleBulletList().run()"
      >• Lista</button>
      <button
        type="button"
        class="rte-btn"
        :class="{ 'rte-btn-active': editor.isActive('orderedList') }"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >1. Lista</button>
      <button type="button" class="rte-btn" @click="setLink">Link</button>
      <button
        type="button"
        class="rte-btn"
        :disabled="!editor.isActive('link')"
        @click="editor.chain().focus().unsetLink().run()"
      >Ukloni link</button>
    </div>
    <EditorContent :editor="editor" class="rte-content" />
  </div>
</template>

<script setup>
import { Editor, EditorContent } from '@tiptap/vue-3'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'

// StarterKit's default schema doesn't know about a "class" attribute on
// paragraphs/headings, so it silently drops one on load (e.g. the
// "lead-paragraph" class used to style the intro line on o-nama) — this
// keeps whatever class was already on the element through the parse/save
// round-trip instead of stripping it.
const PreserveClass = Extension.create({
  name: 'preserveClass',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          class: {
            default: null,
            parseHTML: (element) => element.getAttribute('class'),
            renderHTML: (attributes) => (attributes.class ? { class: attributes.class } : {}),
          },
        },
      },
    ]
  },
})

const props = defineProps({
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const editor = shallowRef(null)

onMounted(() => {
  editor.value = new Editor({
    extensions: [StarterKit, Link.configure({ openOnClick: false }), PreserveClass],
    content: props.modelValue || '',
    onUpdate: ({ editor: e }) => emit('update:modelValue', e.getHTML()),
  })
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})

watch(
  () => props.modelValue,
  (value) => {
    if (editor.value && value !== editor.value.getHTML()) {
      editor.value.commands.setContent(value || '', false)
    }
  },
)

function setLink() {
  const previousUrl = editor.value.getAttributes('link').href
  const url = window.prompt('URL', previousUrl || 'https://')
  if (url === null) return
  if (url === '') {
    editor.value.chain().focus().unsetLink().run()
    return
  }
  editor.value.chain().focus().setLink({ href: url }).run()
}
</script>

<style lang="scss" scoped>
.rte {
  border: 1px solid $color-border;
  border-radius: $radius-card;
  overflow: hidden;
}

.rte-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
  background: $color-background;
  border-bottom: 1px solid $color-border;
}

.rte-btn {
  padding: 4px 10px;
  font-size: $font-size-muted;
  border: 1px solid transparent;
  border-radius: 4px;
  background: none;
  color: $color-text;
  cursor: pointer;
}

.rte-btn:hover {
  border-color: $color-border;
}

.rte-btn-active {
  background: $color-surface;
  border-color: $color-primary;
  color: $color-primary;
}

.rte-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rte-content {
  padding: 12px 14px;
  min-height: 260px;
  max-height: 520px;
  overflow-y: auto;
}

.rte-content :deep(.ProseMirror) {
  outline: none;
  min-height: 240px;
}

.rte-content :deep(h2) {
  font-size: $font-size-section-title;
  margin: 16px 0 8px;
}

.rte-content :deep(h2:first-child) {
  margin-top: 0;
}

.rte-content :deep(p) {
  margin: 0 0 12px;
  line-height: 1.6;
}

.rte-content :deep(ul),
.rte-content :deep(ol) {
  padding-left: 20px;
  margin: 0 0 12px;
}
</style>
