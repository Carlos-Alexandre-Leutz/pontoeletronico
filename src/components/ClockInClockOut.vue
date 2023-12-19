<!-- PontoEletronico.vue -->
<template>
  <div style="margin: 0 auto">
    <h1>Marcação de Ponto Eletrônico</h1>
    <Filtro v-if="registros.length" :tasks="registros"></Filtro>
    <button @click="iniciarPonto">Iniciar Periodo</button>
    <!-- <button @click="pararPonto">Finalizar Dia</button>
    <button @click="pausarPonto">Pausar</button> -->
    <div v-for="registro in registros" :key="registro.userId" class="col-md-10">
      <div class="card">
        <div class="card-body">
          <h5 class="card-title">
            Dia: {{ registro.data.data.dia }}/{{ registro.data.data.mes }}/{{
              registro.data.data.ano
            }}
          </h5>
          <br />
          hora inicio: {{ registro.data.horaInicio.horas }}:{{
            registro.data.horaInicio.minutos
          }}
          <br />
          <template
            v-if="
              timeSpentTask(registro.data.horaInicio, registro.data.horaFim)
            "
          >
            Hora fim: {{ registro.data.horaFim.horas }}:{{
              registro.data.horaFim.minutos
            }}
            <br />
          </template>
          Tempo gasto:
          {{ timeSpentTask(registro.data.horaInicio, registro.data.horaFim) }}
          <br />
          <template
            v-if="
              !timeSpentTask(registro.data.horaInicio, registro.data.horaFim)
            "
          >
            <button @click="pararPonto(registro.key, registro)">
              Finalizar Periodo
            </button>
          </template>
          <button
            v-if="
              validarDataMaiorHoje(
                registro.data.data.dia,
                registro.data.data.mes,
                registro.data.data.ano
              )
            "
            @click="adiconarTarefa(registro.key, registro)"
          >
            adiconar Tarefa
          </button>
          <div v-for="(tarefa, index) in registro.tarefas" :key="tarefa">
            <template v-if="tarefa">
              <div class="col-md-10">
                <div class="card">
                  <div class="card-body">
                    <h4 class="card-title">{{ tarefa.taskNumber }}</h4>
                    <h5 class="card-title">{{ tarefa.descricao }}</h5>
                    hora inicio: {{ tarefa.horaInicio.horas }}:{{
                      tarefa.horaInicio.minutos
                    }}
                    <template
                      v-if="timeSpentTask(tarefa.horaInicio, tarefa.horaFim)"
                    >
                      Hora fim: {{ tarefa.horaFim.horas }}:{{
                        tarefa.horaFim.minutos
                      }}
                      <br />
                    </template>

                    Tempo gasto:
                    {{ timeSpentTask(tarefa.horaInicio, tarefa.horaFim) }}
                    <template
                      v-if="!timeSpentTask(tarefa.horaInicio, tarefa.horaFim)"
                    >
                      <button
                        @click="finalizarTarefa(registro.key, registro, index)"
                      >
                        Finalizar Tarefa
                      </button>
                      <br />
                    </template>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Filtro from "./FilterComponent.vue";
import { getAuth } from "firebase/auth";
import { getDatabase, get, ref, push, set } from "firebase/database";
import Swal from "sweetalert2";

export default {
  data() {
    return {
      registros: [],
    };
  },
  components: {
    Filtro: Filtro,
  },
  methods: {
    iniciarPonto() {
      Swal.fire({
        title: "Adicione o numero da tarefa que você vai iniciar",
        input: "text",
        inputAttributes: {
          autocapitalize: "off",
        },
        showCancelButton: true,
        confirmButtonText: "Salvar",
        showLoaderOnConfirm: true,
        allowOutsideClick: () => !Swal.isLoading(),
      }).then((result) => {
        if (result.isConfirmed) {
          Swal.fire({
            title: "Adicione a descrição",
            input: "text",
            inputAttributes: {
              autocapitalize: "off",
            },
            showCancelButton: true,
            confirmButtonText: "Salvar",
            showLoaderOnConfirm: true,
            allowOutsideClick: () => !Swal.isLoading(),
          }).then((descricao) => {
            if (descricao.isConfirmed) {
              this.sendPonto(result.value, descricao.value);
            } else {
              return;
            }
          });
        } else {
          return;
        }
      });
    },
    async sendPonto(task, descricao) {
      const auth = getAuth();
      const user = auth.currentUser;

      const db = getDatabase();
      const pontoRef = ref(db, "pontos");

      try {
        let dataAtual = new Date();
        let objetoDataHora = {
          data: {
            dia: dataAtual.getDate(),
            mes: dataAtual.getMonth() + 1,
            ano: dataAtual.getFullYear(),
          },
          horaInicio: {
            horas: dataAtual.getHours(),
            minutos: dataAtual.getMinutes(),
          },
          horaFim: {
            horas: dataAtual.getHours(),
            minutos: dataAtual.getMinutes(),
          },
          tarefas: [],
        };

        const novoRegistro = {
          data: objetoDataHora,
          tarefas: [
            {
              taskNumber: task,
              descricao: descricao,
              horaInicio: {
                horas: dataAtual.getHours(),
                minutos: dataAtual.getMinutes(),
              },
              horaFim: {
                horas: dataAtual.getHours(),
                minutos: dataAtual.getMinutes(),
              },
            },
          ],
        };

        // Adiciona um novo registro no Realtime Database
        const novoRegistroRef = push(pontoRef);
        await set(novoRegistroRef, {
          ...novoRegistro,
          userId: user.uid,
        });

        console.log(
          "Registro de ponto salvo com sucesso:",
          novoRegistroRef.key
        );

        // Atualiza a lista de registros na interface do usuário
        this.registros.reverse();
        this.registros.push({ ...novoRegistro, id: novoRegistroRef.key });
        this.registros.reverse();
      } catch (error) {
        console.error("Erro ao marcar ponto:", error.message);
      }
    },
    async pararPonto(registroId, registro) {
      const auth = getAuth();
      const user = auth.currentUser;

      const db = getDatabase();
      const pontoRef = ref(db, `pontos/${registroId}`);

      try {
        if (registro.userId === user.uid) {
          // Atualiza a propriedade horaFim para a data atual
          let dataAtual = new Date();
          registro.data.horaFim = {
            horas: dataAtual.getHours(),
            minutos: dataAtual.getMinutes(),
          };

          // Atualiza o registro no Firebase
          await set(pontoRef, registro);

          console.log("Registro de ponto finalizado com sucesso:", registroId);

          // // Atualiza a lista de registros na interface do usuário
          // const index = this.registros.findIndex((r) => r.id === registroId);
          // this.$set(this.registros, index, { ...registro, id: registroId });
        } else {
          console.warn("O registro não pertence ao usuário atual.");
        }
      } catch (error) {
        console.error("Erro ao finalizar ponto:", error.message);
      }
    },
    adiconarTarefa(registroId, registro) {
      let tarefaEmAndamento = false;
      registro.tarefas.forEach((tarefa) => {
        console.log(tarefa);
        if (!this.timeSpentTask(tarefa.horaInicio, tarefa.horaFim)) {
          console.log(
            "A tarefa " +
              tarefa.descricao +
              " não foi finalizada, finalizar antes de iniciar outra"
          );
          tarefaEmAndamento = true;
          Swal.fire({
            title:
              "a tarefa " +
              tarefa.descricao +
              " não foi finalizada, finalizar antes de iniciar outra",
            confirmButtonText: "OK",
          });
        }
      });
      if (!tarefaEmAndamento) {
        Swal.fire({
          title: "Adicione o nome da tarefa que você vai iniciar",
          input: "text",
          inputAttributes: {
            autocapitalize: "off",
          },
          showCancelButton: true,
          confirmButtonText: "Salvar",
          showLoaderOnConfirm: true,
          allowOutsideClick: () => !Swal.isLoading(),
        }).then((result) => {
          if (result.isConfirmed) {
            this.sendTask(registroId, registro, result.value);
          } else {
            return;
          }
        });
      }
    },
    async sendTask(registroId, registro, taskName) {
      const auth = getAuth();
      const user = auth.currentUser;

      const db = getDatabase();
      const pontoRef = ref(db, `pontos/${registroId}`);
      console.log(taskName);
      try {
        console.log(taskName);
        if (registro.userId === user.uid) {
          // Atualiza a propriedade horaFim para a data atual
          let dataAtual = new Date();
          console.log(taskName);
          const tarefa = {
            descricao: taskName,
            horaInicio: {
              horas: dataAtual.getHours(),
              minutos: dataAtual.getMinutes(),
            },
            horaFim: {
              horas: dataAtual.getHours(),
              minutos: dataAtual.getMinutes(),
            },
          };
          console.log(registro.data);
          registro.tarefas.push(tarefa);
          // Atualiza o registro no Firebase
          await set(pontoRef, registro);

          console.log("Registro de ponto finalizado com sucesso:", registroId);

          // // Atualiza a lista de registros na interface do usuário
          // const index = this.registros.findIndex((r) => r.id === registroId);
          // this.$set(this.registros, index, { ...registro, id: registroId });
        } else {
          console.warn("O registro não pertence ao usuário atual.");
        }
      } catch (error) {
        console.error("Erro ao finalizar ponto:", error.message);
      }
    },
    async finalizarTarefa(registroId, registro, index) {
      const auth = getAuth();
      const user = auth.currentUser;
      let dataAtual = new Date();

      const db = getDatabase();
      const pontoRef = ref(db, `pontos/${registroId}`);

      try {
        if (registro.userId === user.uid) {
          console.log(registro.tarefas[index].horaFim);
          registro.tarefas[index].horaFim = {
            horas: dataAtual.getHours(),
            minutos: dataAtual.getMinutes(),
          };

          // Atualiza o registro no Firebase
          await set(pontoRef, registro);

          console.log("Registro de ponto finalizado com sucesso:", registroId);

          // // Atualiza a lista de registros na interface do usuário
          // const index = this.registros.findIndex((r) => r.id === registroId);
          // this.$set(this.registros, index, { ...registro, id: registroId });
        } else {
          console.warn("O registro não pertence ao usuário atual.");
        }
      } catch (error) {
        console.error("Erro ao finalizar ponto:", error.message);
      }
    },
    timeSpentTask(horaInicio, horaFim) {
      let dataInicio = new Date();
      dataInicio.setHours(horaInicio.horas);
      dataInicio.setMinutes(horaInicio.minutos);

      let dataFim = new Date();
      dataFim.setHours(horaFim.horas);
      dataFim.setMinutes(horaFim.minutos);

      // Calculando a diferença em milissegundos
      let diferencaEmMilissegundos = dataFim - dataInicio;

      // Convertendo a diferença para minutos
      let diferencaEmMinutos = diferencaEmMilissegundos / (1000 * 60);
      if (!diferencaEmMinutos) {
        return 0;
      }
      return this.dataFormat(diferencaEmMinutos);
    },
    dataFormat(minutos) {
      let horas = Math.floor(minutos / 60);
      let minutosRestantes = minutos % 60;

      // Formata as horas e minutos com dois dígitos
      let horasFormatadas = horas < 10 ? "0" + horas : horas;
      let minutosFormatados =
        minutosRestantes < 10 ? "0" + minutosRestantes : minutosRestantes;

      return horasFormatadas + ":" + minutosFormatados;
    },
    async pausarPonto() {},
    validarDataMaiorHoje(dia, mes, ano) {
      const dataAtual = new Date();
      const anoAtual = dataAtual.getFullYear();
      const mesAtual = dataAtual.getMonth() + 1;
      const diaAtual = dataAtual.getDate();
      if (dia == diaAtual && mes == mesAtual && ano == anoAtual) {
        return true;
      }
      return false;
    },
  },

  async created() {
    const db = getDatabase();
    const pontoRef = ref(db, "pontos");

    // Consulta os registros de ponto do usuário no Realtime Database
    // Este exemplo apenas carrega os últimos 10 registros, você pode ajustar conforme necessário
    const snapshot = await get(pontoRef, "value");
    const registros = [];

    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const key = childSnapshot.key;
        const data = childSnapshot.val();
        registros.push({ key, ...data });
      });
    }

    this.registros = registros.reverse();
  },
};
</script>
