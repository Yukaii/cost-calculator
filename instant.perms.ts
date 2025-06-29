import type { InstantRules } from '@dorilama/instantdb-vue'

const rules = {
  "ingredients": {
    "allow": {
      "view": "auth.id != null",
      "create": "auth.id != null",
      "update": "auth.id != null",
      "delete": "auth.id != null",
    }
  },
  "compound_ingredients": {
    "allow": {
      "view": "auth.id != null",
      "create": "auth.id != null",
      "update": "auth.id != null",
      "delete": "auth.id != null",
    }
  },
  "recipes": {
    "allow": {
      "view": "auth.id != null",
      "create": "auth.id != null",
      "update": "auth.id != null",
      "delete": "auth.id != null",
    }
  },
  "recipe_ingredients": {
    "allow": {
      "view": "auth.id != null",
      "create": "auth.id != null",
      "update": "auth.id != null",
      "delete": "auth.id != null",
    }
  },
  "$users": {
    "allow": {
      "view": "auth.id != null && auth.id == data.id",
      "create": "false",
      "update": "false",
      "delete": "false",
    }
  },
  "attrs": {
    "allow": {
      "create": "auth.id != null"
    }
  }
} satisfies InstantRules

export default rules