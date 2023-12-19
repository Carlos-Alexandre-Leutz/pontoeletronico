<!-- SignUp.vue -->
<template>
  <div>
    <h1>Criar Nova Conta</h1>
    <form @submit.prevent="signup">
      <label for="name">Nome:</label>
      <input type="text" v-model="name" required />
      <label for="email">Email:</label>
      <input type="email" v-model="email" required />
      <label for="password">Senha:</label>
      <input type="password" v-model="password" required />
      <button type="submit">Criar Conta</button>
    </form>
  </div>
</template>

<script>
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";

export default {
  data() {
    return {
      name: "",
      email: "",
      password: "",
    };
  },
  methods: {
    async signup() {
      const auth = getAuth();
      try {
        // Cria o usuário no Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          this.email,
          this.password
        );

        // Atualiza o perfil do usuário com o nome
        await updateProfile(userCredential.user, { displayName: this.name });

        console.log("Usuário criado com sucesso");
        // Redirecione para a página após o cadastro
        this.$router.push("/dashboard");
      } catch (error) {
        console.error("Erro ao criar usuário:", error.message);
      }
    },
  },
};
</script>
