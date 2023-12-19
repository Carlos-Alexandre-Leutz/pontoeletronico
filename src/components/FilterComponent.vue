<template>
  <div class="container mt-3">
    <div class="row justify-content-end">
      <div class="col-md-4">
        <div class="input-group">
          <input
            type="text"
            class="form-control"
            placeholder="Digite aqui..."
            v-model="viewModel.busca"
          />
          <div class="input-group-append">
            <button
              @click="buscarTempoGastoPorTarefa()"
              class="btn btn-outline-secondary"
              type="button"
            >
              Buscar
            </button>
            {{ viewModel.result }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
export default {
  props: {
    tasks: {
      type: Array,
      default: () => {
        return [];
      },
    },
  },
  data() {
    return {
      viewModel: {
        busca: "",
        result: "",
        data: "",
      },
    };
  },
  mounted() {
    this.viewModel.data = this.tasks;
  },
  methods: {
    buscarTempoGastoPorTarefa() {
      try {
        let tempoTotal = 0;
        this.viewModel.data.forEach((item) => {
          if (item.tarefas) {
            item.tarefas.forEach((tarefa) => {
              console.log(tarefa);
              if (
                tarefa.descricao
                  .toLowerCase()
                  .includes(this.viewModel.busca.toLowerCase())
              ) {
                const tempoGastoEmMinutos =
                  tarefa.horaFim.horas * 60 +
                  tarefa.horaFim.minutos -
                  (tarefa.horaInicio.horas * 60 + tarefa.horaInicio.minutos);

                tempoTotal += tempoGastoEmMinutos;
              }
            });
          }
        });

        const horas = Math.floor(tempoTotal / 60);
        const minutos = tempoTotal % 60;
        this.viewModel.result = `${horas}:${minutos}`;
      } catch (error) {
        console.error("Erro:", error);
      }
    },
  },
};
</script>
