// new Date().toISOString() usa UTC e pode adiantar/atrasar um dia perto da meia-noite
// dependendo do fuso local — usamos os componentes locais da data pra montar o
// "hoje" que compara com o campo `data` (YYYY-MM-DD) de outras entidades.
export function hojeISO(): string {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function estaAtrasada(tarefa: { data: string; concluida: boolean }, hoje: string): boolean {
  return !tarefa.concluida && tarefa.data < hoje
}
