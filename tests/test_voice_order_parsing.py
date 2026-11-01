import pytest

from backend.app.services.order_parser import parse_order
from backend.app.services.parser import find_product
from backend.app.services.quantity_parser import NUMBER_MAP, extract_quantity
from backend.app.services.session import OrderSession
from backend.app.services.transcript_splitter import split_commands


TRANSCRIPT_CASES = [
    (
        "five packet amul butter two packet parle ji actually four packet amul butter",
        {"Amul Butter": 4, "Parle G": 2},
    ),
    (
        "three packet maggie two packet good day biscuit one kilo tata salt",
        {"Maggi": 3, "Good Day": 2, "Tata Salt": 1},
    ),
    (
        "two litre amul milk five packet parleji one kilo ashirvad atta",
        {"Amul Milk": 2, "Parle G": 5, "Aashirvaad Atta": 1},
    ),
    (
        "five packet maggie no three packet maggie",
        {"Maggi": 3},
    ),
    (
        "two packet amul butter actually four packet amul butter",
        {"Amul Butter": 4},
    ),
    (
        "do packet amul butter teen packet parle ji ek kilo tata namak",
        {"Amul Butter": 2, "Parle G": 3, "Tata Salt": 1},
    ),
    (
        "do packet amul milk five packet maggie actually three packet maggie",
        {"Amul Milk": 2, "Maggi": 3},
    ),
    (
        "ek kilo ashirvad ata ek liter fortune oil do packet parlegi",
        {"Aashirvaad Atta": 1, "Fortune Oil": 1, "Parle G": 2},
    ),
    (
        "four packet maggie two packet parleji one kilo tata salt",
        {"Maggi": 4, "Parle G": 2, "Tata Salt": 1},
    ),
]


@pytest.mark.parametrize(("transcript", "expected"), TRANSCRIPT_CASES)
def test_transcripts_parse_to_expected_cart(transcript, expected):
    session = OrderSession()

    for command in split_commands(transcript):
        cart = session.handle(command)

    assert cart == expected


@pytest.mark.parametrize(
    ("word", "quantity"),
    [
        ("one", 1),
        ("two", 2),
        ("three", 3),
        ("four", 4),
        ("five", 5),
        ("six", 6),
        ("seven", 7),
        ("eight", 8),
        ("nine", 9),
        ("ten", 10),
        ("ek", 1),
        ("do", 2),
        ("teen", 3),
        ("char", 4),
        ("chaar", 4),
        ("paanch", 5),
        ("chhe", 6),
        ("saat", 7),
        ("aath", 8),
        ("nau", 9),
        ("das", 10),
    ],
)
def test_english_and_hindi_quantity_words(word, quantity):
    assert extract_quantity(f"{word} packet maggi") == quantity
    assert NUMBER_MAP[word] == quantity


@pytest.mark.parametrize("filler", ["actually", "no", "nahi", "correction"])
def test_filler_words_do_not_match_products(filler):
    assert parse_order(filler) is None


def test_fuzzy_product_match_respects_confidence_threshold():
    match = find_product("amool milkk")

    assert match["product"] == "Amul Milk"
    assert match["confidence"] >= 80
    assert find_product("xyz") is None


def test_splitter_keeps_quantity_words_attached_to_their_units():
    assert split_commands(
        "three packet maggie two packet good day biscuit one kilo tata salt"
    ) == [
        "three packet maggie",
        "two packet good day biscuit",
        "one kilo tata salt",
    ]
