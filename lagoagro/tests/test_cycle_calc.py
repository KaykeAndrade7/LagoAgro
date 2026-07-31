from datetime import date

from domain.cycle_calc import dias_restantes, fase_atual


# --- dias_restantes -----------------------------------------------------

def test_dias_restantes_caso_normal_alguns_dias_antes_do_fim():
    data_plantio = date(2026, 1, 1)
    hoje = date(2026, 3, 20)
    assert dias_restantes(data_plantio, 90, hoje) == 12


def test_dias_restantes_primeiro_dia_do_ciclo():
    data_plantio = date(2026, 1, 1)
    hoje = data_plantio
    assert dias_restantes(data_plantio, 90, hoje) == 90


def test_dias_restantes_ultimo_dia_do_ciclo_retorna_zero():
    data_plantio = date(2026, 1, 1)
    hoje = date(2026, 4, 1)  # data_plantio + 90 dias
    assert dias_restantes(data_plantio, 90, hoje) == 0


def test_dias_restantes_um_dia_apos_fim_do_ciclo_e_negativo():
    data_plantio = date(2026, 1, 1)
    hoje = date(2026, 4, 2)  # um dia depois do fim do ciclo
    assert dias_restantes(data_plantio, 90, hoje) == -1


def test_dias_restantes_ciclo_bem_atrasado_valor_bem_negativo():
    data_plantio = date(2026, 1, 1)
    hoje = date(2026, 5, 15)  # semanas após o fim do ciclo de 90 dias
    assert dias_restantes(data_plantio, 90, hoje) == -44


# --- fase_atual -----------------------------------------------------------

FASES_PIMENTAO = [
    {"nome": "muda", "dia_inicio": 0, "dia_fim": 20},
    {"nome": "floracao", "dia_inicio": 21, "dia_fim": 45},
    {"nome": "colheita", "dia_inicio": 46, "dia_fim": 90},
]


def test_fase_atual_dia_dentro_da_primeira_fase():
    data_plantio = date(2026, 1, 1)
    hoje = date(2026, 1, 10)  # dia 9 desde o plantio
    assert fase_atual(data_plantio, FASES_PIMENTAO, hoje) == "muda"


def test_fase_atual_dia_dentro_de_fase_intermediaria():
    data_plantio = date(2026, 1, 1)
    hoje = date(2026, 1, 30)  # dia 29 desde o plantio, cai em floracao
    assert fase_atual(data_plantio, FASES_PIMENTAO, hoje) == "floracao"


def test_fase_atual_no_dia_inicio_da_fase_limite_inferior_inclusivo():
    data_plantio = date(2026, 1, 1)
    hoje = date(2026, 1, 22)  # dia 21, exatamente dia_inicio de floracao
    assert fase_atual(data_plantio, FASES_PIMENTAO, hoje) == "floracao"


def test_fase_atual_no_dia_fim_da_fase_limite_superior_inclusivo():
    data_plantio = date(2026, 1, 1)
    hoje = date(2026, 1, 21)  # dia 20, exatamente dia_fim de muda
    assert fase_atual(data_plantio, FASES_PIMENTAO, hoje) == "muda"


def test_fase_atual_antes_do_plantio_retorna_none():
    data_plantio = date(2026, 1, 10)
    hoje = date(2026, 1, 5)  # dias_passados negativo
    assert fase_atual(data_plantio, FASES_PIMENTAO, hoje) is None


def test_fase_atual_depois_do_fim_de_todas_as_fases_retorna_none():
    data_plantio = date(2026, 1, 1)
    hoje = date(2026, 4, 15)  # muito além do dia_fim de colheita (90)
    assert fase_atual(data_plantio, FASES_PIMENTAO, hoje) is None


def test_fase_atual_gap_de_cadastro_entre_fases_retorna_none():
    # simula cadastro incompleto: fase 1 termina no dia 20, fase 2 só
    # começa no dia 25, deixando os dias 21-24 sem fase cadastrada
    fases_com_gap = [
        {"nome": "muda", "dia_inicio": 0, "dia_fim": 20},
        {"nome": "floracao", "dia_inicio": 25, "dia_fim": 45},
    ]
    data_plantio = date(2026, 1, 1)
    hoje = date(2026, 1, 23)  # dia 22, dentro do gap
    assert fase_atual(data_plantio, fases_com_gap, hoje) is None


def test_fase_atual_lista_de_fases_vazia_retorna_none():
    data_plantio = date(2026, 1, 1)
    hoje = date(2026, 1, 10)
    assert fase_atual(data_plantio, [], hoje) is None
