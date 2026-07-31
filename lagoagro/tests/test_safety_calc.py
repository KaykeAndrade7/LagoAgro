from datetime import date

from domain.safety_calc import data_segura_colheita


def test_data_segura_colheita_uma_unica_aplicacao():
    aplicacoes = [{"data": date(2026, 3, 1), "carencia_dias": 7}]
    assert data_segura_colheita(aplicacoes) == date(2026, 3, 8)


def test_data_segura_colheita_aplicacao_mais_antiga_com_carencia_mais_longa_define_a_data():
    # Este é o caso central da função: uma aplicação nova (05/03, carência de
    # 3 dias, data segura 08/03) não pode "adiantar" a colheita se ainda
    # existe uma aplicação anterior (01/03, carência de 20 dias, data segura
    # 21/03) cuja carência ainda está ativa. Se a função usasse só a
    # aplicação mais recente, retornaria 08/03 e liberaria a colheita cedo
    # demais — o que seria um risco real de segurança alimentar.
    aplicacoes = [
        {"data": date(2026, 3, 1), "carencia_dias": 20},
        {"data": date(2026, 3, 5), "carencia_dias": 3},
    ]
    assert data_segura_colheita(aplicacoes) == date(2026, 3, 21)


def test_data_segura_colheita_aplicacao_mais_recente_com_carencia_mais_longa_caso_normal():
    aplicacoes = [
        {"data": date(2026, 3, 1), "carencia_dias": 3},
        {"data": date(2026, 3, 5), "carencia_dias": 20},
    ]
    assert data_segura_colheita(aplicacoes) == date(2026, 3, 25)


def test_data_segura_colheita_lista_vazia_retorna_none():
    assert data_segura_colheita([]) is None


def test_data_segura_colheita_aplicacoes_com_mesma_data_segura_empate():
    # 01/03 + 10 dias = 11/03; 03/03 + 8 dias = 11/03 -> empate, não deve
    # quebrar e o resultado ainda é 11/03.
    aplicacoes = [
        {"data": date(2026, 3, 1), "carencia_dias": 10},
        {"data": date(2026, 3, 3), "carencia_dias": 8},
    ]
    assert data_segura_colheita(aplicacoes) == date(2026, 3, 11)


def test_data_segura_colheita_carencia_zero_data_segura_e_a_propria_data_da_aplicacao():
    # Simula um adubo cadastrado sem restrição de carência (carencia_dias=0).
    aplicacoes = [{"data": date(2026, 3, 1), "carencia_dias": 0}]
    assert data_segura_colheita(aplicacoes) == date(2026, 3, 1)
